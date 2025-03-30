const http = require("http");
const https = require("https");
const fs = require("fs");
const nodemailer = require('nodemailer');
const path = require("path");
const prompt = require("prompt-sync")();
const users = {};
const emails = {};
let port = 0;

const user = process.env.API_USERNAME;
const pass = process.env.API_PASSWORD;
const host = 'wheatley.cs.up.ac.za';
const apiPath = '/u23547104/api.php';

const options = {
    hostname: host,
    port: 443,
    path: apiPath,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(user + ':' + pass).toString('base64')
    },
};

const transporter = nodemailer.createTransport({
    host: 'smtp-mail.outlook.com',
    port: 587,
    auth: {
        user: 'propertynestza@outlook.com',
        pass: pass
    }
});

const server = http.createServer((req, res) => {
    let filePath = "." + req.url;
    if (filePath === "./") {
        filePath = "./index.html";
    }

    const extname = path.extname(filePath);
    let contentType = "text/html";

    switch (extname) {
        case ".html":
            contentType = "text/html";
            break;
        case ".css":
            contentType = "text/css";
            break;
        case ".js":
            contentType = "text/javascript";
            break;
    }

    filePath = path.join(__dirname, '/COS216/HA/', filePath);
    if (filePath.endsWith('index.html')) {
        fs.readFile(filePath, 'utf8', (err, content) => {
            if (err) {
                if (err.code === "ENOENT") {
                    res.writeHead(404, { "Content-Type": "text/html" });
                    res.end("404 Not Found");
                } else {
                    res.writeHead(500);
                    res.end(`Server Error: ${err.code}`);
                }
            } else {
                const injectedContent = content.replace(
                    '</head>',
                    `<script>
                        window.env = {
                            API_USERNAME: "${user}",
                            API_PASSWORD: "${pass}"
                        };
                    </script></head>`
                );
                res.writeHead(200, { "Content-Type": contentType });
                res.end(injectedContent, "utf-8");
            }
        });
    } else {
        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === "ENOENT") {
                    res.writeHead(404, { "Content-Type": "text/html" });
                    res.end("404 Not Found");
                } else {
                    res.writeHead(500);
                    res.end(`Server Error: ${err.code}`);
                }
            } else {
                res.writeHead(200, { "Content-Type": contentType });
                res.end(content, "utf-8");
            }
        });
    }
});

const io = require("socket.io")(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    let username;

    socket.on("details", (user) => {
        username = user.username;
        users[username] = socket.id;
        emails[username] = user.email;
        console.log(username + " connected with socket ID: " + users[username]);
    });

    socket.on("disconnect", () => {
        console.log(username + " disconnected");
        delete users[username];
        delete emails[username];
    });

    const chunks = {};

    socket.on('setPictureChunk', (chunkData) => {
        const { apikey, chunk, chunkIndex, totalChunks } = chunkData;

        if (!chunks[apikey]) {
            chunks[apikey] = new Array(totalChunks).fill(null);
        }

        chunks[apikey][chunkIndex] = chunk;

        if (chunks[apikey].every(c => c !== null)) {
            const base64String = chunks[apikey].join('');
            delete chunks[apikey];

            httpsRequest(options, JSON.stringify({
                type: "SetPicture",
                apikey: apikey,
                picture: base64String
            }));
        }
    });

    socket.on("bid", async (bid) => {
        const [auctionID, userID, amount] = bid.split(',');

        let auction = await httpsRequest(options, JSON.stringify({
            type: "GetAuction",
            apikey: process.env.API_KEY,
            get_type: "Single",
            auction_id: auctionID
        }));

        if(amount > getHighestBid(auction["data"]["bid_history"]) && amount >= auction["data"]["price"]) {
            if(auction["data"]["bid_history"] === "None") {
                history = userID + ":" + amount;
            }else {
                history = auction["data"]["bid_history"] + "," + userID + ":" + amount;
            }

            httpsRequest(options, JSON.stringify({
                type: "UpdateAuction",
                apikey: process.env.API_KEY,
                auction_id: auctionID,
                highest_bid: Number(amount),
                bid_history: history
            }));
            
            socket.emit("notification", { title: "Congratulations!", message: "You are now the highest bidder." });

            for (const user in users) {
                const username = await getUsername(userID);
                const socket = io.sockets.sockets.get(users[user]);
                
                if (socket) {
                    socket.emit("receiveBid", { auctionID, history: await getHistory(history), highest: getHighestBid(history) });
                }
            }
        }else if (amount <= getHighestBid(auction["data"]["bid_history"])){
            socket.emit("notification", { title: "Error!", message: "Bid failed! You must bid more than the current highest bid: R" + getHighestBid(auction["data"]["bid_history"]).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ") });
        }else if (amount < auction["data"]["price"]){
            socket.emit("notification", { title: "Error!", message: "Bid failed! You must bid atleast as much as the base price: R" + auction["data"]["price"].toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ") });
        }
    });

    socket.on("create", (auctionDetails) => {
        const auctionChunks = {};
    
        const handleCreateAuctionImageChunk = async (chunkData) => {
            const { apikey, chunk, chunkIndex, totalChunks } = chunkData;
    
            if (!auctionChunks[apikey]) {
                auctionChunks[apikey] = new Array(totalChunks).fill(null);
            }
    
            auctionChunks[apikey][chunkIndex] = chunk;
    
            if (auctionChunks[apikey].every(c => c !== null)) {
                const base64String = auctionChunks[apikey].join('');
                delete auctionChunks[apikey];
    
                await httpsRequest(options, JSON.stringify({
                    type: "CreateAuction",
                    apikey: auctionDetails.apikey,
                    auction_id: generateAuctionID(),
                    auction_name: auctionDetails.auction_name,
                    start_date: auctionDetails.start_date,
                    end_date: auctionDetails.end_date,
                    title: auctionDetails.title,
                    price: Number(auctionDetails.price),
                    location: auctionDetails.location,
                    bathrooms: Number(auctionDetails.bathrooms),
                    bedrooms: Number(auctionDetails.bedrooms),
                    parking_spaces: Number(auctionDetails.parking_spaces),
                    description: auctionDetails.description,
                    amenities: auctionDetails.amenities,
                    image: base64String,
                    auctioneer_id: Number(auctionDetails.auctioneer_id)
                }));
    
                io.sockets.emit("refreshAuctions");
                socket.off('createAuctionImageChunk', handleCreateAuctionImageChunk);
                socket.off('createAuctionNullImage', handleCreateAuctionNullImage);
            }
        };
    
        const handleCreateAuctionNullImage = async () => {
            await httpsRequest(options, JSON.stringify({
                type: "CreateAuction",
                apikey: auctionDetails.apikey,
                auction_id: generateAuctionID(),
                auction_name: auctionDetails.auction_name,
                start_date: auctionDetails.start_date,
                end_date: auctionDetails.end_date,
                title: auctionDetails.title,
                price: Number(auctionDetails.price),
                location: auctionDetails.location,
                bathrooms: Number(auctionDetails.bathrooms),
                bedrooms: Number(auctionDetails.bedrooms),
                parking_spaces: Number(auctionDetails.parking_spaces),
                description: auctionDetails.description,
                amenities: auctionDetails.amenities,
                image: auctionDetails.null,
                auctioneer_id: Number(auctionDetails.auctioneer_id)
            }));
    
            io.sockets.emit("refreshAuctions");
            socket.off('createAuctionImageChunk', handleCreateAuctionImageChunk);
            socket.off('createAuctionNullImage', handleCreateAuctionNullImage);
        };
    
        socket.on('createAuctionImageChunk', handleCreateAuctionImageChunk);
        socket.on('createAuctionNullImage', handleCreateAuctionNullImage);
    });
    

    socket.on("stop", async (auctionID) => {
        const auction = await httpsRequest(options, JSON.stringify({
            type: "GetAuction",
            apikey: process.env.API_KEY,
            get_type: "Single",
            auction_id: auctionID
        }));

        httpsRequest(options, JSON.stringify({
            type: "UpdateAuction",
            apikey: process.env.API_KEY,
            auction_id: auctionID,
            state: "Done",
            bid_history: auction.data.bid_history + ",Auction winner:Auction canceled!"
        }));

        io.sockets.emit("stateChange", { auctionID, state: "Done", highest: "Auction canceled!" });
    });

    socket.on("getAllAuctions", async () => {
        const auctionData = await getAuctionData();
        let auctions = Array();
        let auctioneers = Array();
        let buyers = Array();

        for (const auctionID of auctionData.data) {
            const auction = await httpsRequest(options, JSON.stringify({
                type: "GetAuction",
                apikey: process.env.API_KEY,
                get_type: "Single",
                auction_id: auctionID.auction_id
            }));

            auctions.push(auction)
            auctioneers.push(await getUsername(auction.data.auctioneer_id));
            buyers.push(await getUsername(auction.data.buyer_id));
        }

        socket.emit("receiveAllAuctions", { auctions, auctioneers, buyers });
    });

    socket.on("getAuction", async (auction_id) => {
        const auction = await httpsRequest(options, JSON.stringify({
            type: "GetAuction",
            apikey: process.env.API_KEY,
            get_type: "Single",
            auction_id: auction_id
        }));

        let user = await getUsername(auction.data.auctioneer_id);
        let buyer = await getUsername(auction.data.buyer_id);
        let history = await getHistory(auction.data.bid_history);

        socket.emit("receiveAuction", { auction, user, buyer, history });
    });
});

process.stdin.on("data", async (data) => { // for commands KILL, LIST, QUIT, AUCTIONS
    const input = data.toString().trim();
    const [command, ...usernameParts] = input.split(" ");
    const username = usernameParts.join(" ").trim();

    if (command === "KILL") {
        if (users[username]) {
            io.sockets.sockets.get(users[username]).emit("notification", { title: "Attention!", message: "You have been disconnected." });
            io.sockets.sockets.get(users[username]).disconnect();
            console.log("Connection for " + username + " closed.\n");
        } else {
            console.log("No active connection found for " + username + ".\n");
        }
    }else if(command === "LIST") {
        console.log("Listing active connections:");

        for (const user in users) {
            console.log(user + ", " + users[user]);
        }

        console.log("Done.\n");
    }else if(command === "QUIT") {
        console.log("Closing active connections:");
        
        for (const user in users) {
            const socket = io.sockets.sockets.get(users[user]);
            if (socket) {
                socket.emit("notification", { title: "Attention!", message: "The server has been shut down. You will now be disconnected." }); // needed
                socket.disconnect();
            }
        }

        setTimeout(() => {
            server.close();
            console.log("Server closed.");
            process.exit(0);
        }, 3000);
    }else if(command === "AUCTIONS") {
        console.log("Listing all active auctions:");
        const auctionData = await getAuctionData();

        for (const auction of auctionData.data) {
            if(auction.state != "Done") {
                let bidders;

                if (auction.bid_history !== "None") {
                    const bidderIDs = extractBidderIDs(auction.bid_history);
                    const bidderPromises = bidderIDs.map(bidderID => getUsername(bidderID));
                    
                    bidders = await Promise.all(bidderPromises);

                } else {
                    bidders = "None";
                }

                console.log(`${auction.auction_id}, ${auction.title}, [${bidders}], ${auction.state}`);
            }
        }

        console.log("Done.\n");
    }else {
        console.log("Unknown command '" + command + "'\n");
    }
});

function startServer() {
    server.listen(port, () => {
        console.log("Server running on port: " + port + ".\n");
    });
}

function extractBidderIDs(bidHistory) {
    const bidArray = bidHistory.split(",");
    const bidders = new Set();

    bidArray.forEach((bid) => {
        const [bidder, amount] = bid.split(":");
        bidders.add(bidder.trim());
    });

    return Array.from(bidders);
}

function generateAuctionID() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let auctionID = '';

    for (let i = 0; i < 10; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        auctionID += characters.charAt(randomIndex);
    }

    return auctionID;
}

function checkAuctionTimes() { // starts and stops auctions
    const auctionReq = https.request(options, (auctionRes) => {
        let auctionData = '';

        auctionRes.on('data', (chunk) => {
            auctionData += chunk;
        });

        auctionRes.on('end', async () => {
            auctionData = JSON.parse(auctionData);

            for(const auction of auctionData["data"]) {
                const now = new Date();

                if(new Date(auction.start_date) <= now && auction.state == "Waiting") {
                    const updateStart = https.request(options);

                    const update = JSON.stringify({
                        type: "UpdateAuction",
                        apikey: process.env.API_KEY,
                        auction_id: auction.auction_id,
                        state: "Ongoing"
                    });
                
                    updateStart.write(update);
                    updateStart.end();

                    io.sockets.emit("stateChange", { auctionID: auction.auction_id, state: "Ongoing" });
                    io.sockets.emit("notification", { title: "Attention!", message: "Auction '" + auction.title + "' has started!" }); // needed
                }else if(new Date(auction.end_date) <= now && auction.state != "Done") {
                    const updateEnd = https.request(options);
                    const highestBidder = getHighestBidder(auction.bid_history);
                    const highestBidderUsername = await getUsername(highestBidder);
                    const history = auction.bid_history += ",Auction winner:" + highestBidderUsername;

                    const update = JSON.stringify({
                        type: "UpdateAuction",
                        apikey: process.env.API_KEY,
                        auction_id: auction.auction_id,
                        state: "Done",
                        buyer_id: highestBidder,
                        bid_history: history
                    });
                
                    updateEnd.write(update);
                    updateEnd.end();

                    io.sockets.emit("stateChange", { auctionID: auction.auction_id, state: "Done", highest: highestBidderUsername });

                    for(const user in users) {
                        const socket = io.sockets.sockets.get(users[user]);

                        if(user == highestBidderUsername) {
                            if (socket) {
                                socket.emit("notification", { title: "Congratulations!", message: "You just won an auction: '" + auction.title + "'" });

                                var mailOptions = {
                                    from: 'propertynestza@outlook.com',
                                    to: emails[highestBidderUsername],
                                    subject: 'Congratulations!',
                                    text: 'You just won an auction: "' + auction.title + '"\nGo to PropertyNest.com to view it!'
                                };

                                transporter.sendMail(mailOptions, function(error, info){
                                    if (error) {
                                      console.log(error);
                                    } else {
                                      console.log('Email sent to ' + emails[highestBidderUsername]);
                                    }
                                });
                            }
                        }else {
                            socket.emit("notification", { title: "Attention!", message: "Auction '" + auction.title + "' has ended!" });
                        }
                    }
                }
            }
        });
    });

    const body = JSON.stringify({
        type: "GetAuction",
        apikey: process.env.API_KEY,
        get_type: "All"
    });

    auctionReq.write(body);
    auctionReq.end();
}

function getHighestBidder(bidHistory) {
    if (!bidHistory || bidHistory === "None") {
        return null;
    }

    const bids = bidHistory.split(',');
    let highestBid = 0;
    let highestBidderId = null;

    for (const bid of bids) {
        const [id, amount] = bid.split(':');
        const bidAmount = parseFloat(amount);

        if (bidAmount > highestBid) {
            highestBid = bidAmount;
            highestBidderId = id;
        }
    }

    return Number(highestBidderId);
}

function getHighestBid(bidHistory) {
    if (!bidHistory || bidHistory === "None") {
        return 0;
    }

    const bids = bidHistory.split(',');
    let highestBid = 0;
    let highestBidderId = null;

    for (const bid of bids) {
        const [id, amount] = bid.split(':');
        const bidAmount = parseFloat(amount);

        if (bidAmount > highestBid) {
            highestBid = bidAmount;
            highestBidderId = id;
        }
    }

    return Number(highestBid);
}

async function getUsername(userID) {
    if(userID == null) {
        return "None";
    }

    const response = await httpsRequest(options, JSON.stringify({
        type: "GetUsername",
        apikey: process.env.API_KEY,
        id: userID
    }));

    return response.data;
}

async function getHistory(history) {
    if(history === "None") {
        return "<p>No bids yet!</p>";
    }

    var ret = "";
    const bidHistory = history.split(',');

    for (const bid of bidHistory) {
        if(bid != "None") {
            const [id, amount] = bid.split(':');
        
            if(id == "Auction winner") {
                ret += "<p><strong>" + id + "</strong><br>" + amount + "</p>";
            }else {
                ret += "<p><strong>" + await getUsername(id) + "</strong><br>R" + parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "</p>";
            }
        }
    }

    return ret;
}

function httpsRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    resolve(parsedData);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (body) {
            req.write(body);
        }
        req.end();
    });
}

async function getAuctionData() {
    return await httpsRequest(options, JSON.stringify({
        type: "GetAuction",
        apikey: process.env.API_KEY,
        get_type: "All"
    }));
}

if (process.argv.length >= 3) {
    port = parseInt(process.argv[2]);

    if(port < 1024 || port > 49151) {
        console.log("Error: Port number must be between 1024 and 49151.");
    }
}

while(port < 1024 || port > 49151) {
    port = parseInt(prompt("Enter port number [1024-49151]: "));

    if(port < 1024 || port > 49151) {
        console.log("Error: Port number must be between 1024 and 49151.");
    }
}

startServer();
checkAuctionTimes();
setInterval(checkAuctionTimes, 10000);