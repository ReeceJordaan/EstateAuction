var loginBtn = document.getElementById('login-button');
var loginForm = document.getElementById('login-form');
var popupContainer = document.getElementById('popupContainer');
var closePopupBtn = document.getElementById('closePopup');
var createAuctionBtn = document.getElementById('createAuctionBtn');
var createAuctionForm = document.getElementById('createAuctionForm');
let isRefreshingAuctions = false;
var socket;

if(localStorage.getItem("apikey") != null) {
    socket = io();

    socket.on("connect", () => {
        document.querySelector('.status-img').src = "img/connected.png";
        socket.emit("details", {username: localStorage.getItem("name") + " " + localStorage.getItem("surname"), email: localStorage.getItem("email")} );
    });

    socket.on("disconnect", () => {
        document.querySelector('.status-img').src = "img/disconnected.png";
    });

    socket.on("notification", (notification) => {
        addNotification(notification.title, notification.message);
    });

    socket.on("receiveBid", (bid) => {
        if(document.getElementById(bid.auctionID + "allHighestWidget") != null) {
            document.getElementById(bid.auctionID + "allHighestWidget").innerText = "R" + bid.highest.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        }
        if(document.getElementById(bid.auctionID + "myHighestWidget") != null) {
            document.getElementById(bid.auctionID + "myHighestWidget").innerText = "R" + bid.highest.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        }
        if(document.getElementById(bid.auctionID + "historyContainer") != null) {
            document.getElementById(bid.auctionID + "historyContainer").innerHTML = bid.history;
            document.getElementById(bid.auctionID + "viewHighestWidget").innerText = "R" + bid.highest.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        }
    });

    socket.on("stateChange", async (stateChange) => {
        await waitForRefreshToComplete();
    
        var allContainer = document.getElementById(stateChange.auctionID + "AllContainer");
    
        var allState = document.getElementById(stateChange.auctionID + "AllState");
        var myState = document.getElementById(stateChange.auctionID + "MyState");
        var viewState = document.getElementById(stateChange.auctionID + "ViewState");
    
        var allView = document.getElementById(stateChange.auctionID + "AllView");
    
        var historyContainer = document.getElementById(stateChange.auctionID + "historyContainer");
        var placeBid = document.getElementById(stateChange.auctionID + "placeBid");
    
        var cancelBtn = document.getElementById(stateChange.auctionID + "myCancel");
    
        if (stateChange.state == "Ongoing") {
            if (allState != null) {
                allState.innerText = "Ongoing";
                allState.style.backgroundColor = "#90EE90";
                allView.style.display = "flex";
            }
    
            if (myState != null) {
                myState.innerText = "Ongoing";
                myState.style.backgroundColor = "#90EE90";
            }
    
            if (viewState != null) {
                viewState.innerText = "Ongoing";
                viewState.style.backgroundColor = "#90EE90";
            }
        } else if (stateChange.state == "Done") {
            if (allContainer != null) {
                allContainer.remove();
    
                if (document.querySelector(".allAuctions").getElementsByClassName("auctionContainer").length == 0) {
                    document.querySelector(".empty").style.display = "block";
                }
            }
    
            if (myState != null) {
                myState.innerText = "Done";
                myState.style.backgroundColor = "#FFD700";
                cancelBtn.style.cursor = "not-allowed";
                cancelBtn.onclick = null;
            }
    
            if (viewState != null) {
                viewState.innerText = "Done";
                viewState.style.backgroundColor = "#FFD700";
            }
    
            if (historyContainer != null) {
                if (historyContainer.innerHTML == "<p>No bids yet!</p>") {
                    historyContainer.innerHTML = "<p><strong>Auction winner</strong><br>" + stateChange.highest + "</p>";
                } else {
                    historyContainer.innerHTML += "<p><strong>Auction winner</strong><br>" + stateChange.highest + "</p>";
                }
    
                placeBid.style.cursor = "not-allowed";
                placeBid.onclick = null;
            }
        }
    });
    
    function waitForRefreshToComplete() {
        return new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (!isRefreshingAuctions) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }

    socket.on("refreshAuctions", async () => {
        isRefreshingAuctions = true;

        if(document.querySelector(".allAuctions").style.display == "flex") {
            await populateAllAuctions();
        }

        if(document.querySelector(".myAuctions").style.display == "flex") {
            await populateMyAuctions();
        }

        isRefreshingAuctions = false;
    });
}

async function loadAllAuctions() {
    if(localStorage.getItem("apikey") == null) {
        document.querySelector(".allAuctions").style.display = "none";
        document.querySelector(".myAuctions").style.display = "none";
        document.querySelector(".myWins").style.display = "none";
        document.querySelector(".viewAuction").style.display = "none";
        document.querySelector(".empty").style.display = "none";
        document.querySelector(".login-to-view").style.display = "block";
        document.querySelector(".user-info").style.display = "none";
        document.querySelector(".login-register").style.display = "flex";
        document.querySelector("#createBtn").style.display = "none";
    }else {
        document.querySelector(".loading").style.display = "flex";
        document.querySelector(".allAuctions").style.display = "none";
        document.querySelector(".myAuctions").style.display = "none";
        document.querySelector(".myWins").style.display = "none";
        document.querySelector(".viewAuction").style.display = "none";
        document.querySelector(".empty").style.display = "none";
        document.querySelector(".login-to-view").style.display = "none";
        document.querySelector(".user-info").style.display = "flex";
        document.querySelector(".login-register").style.display = "none";
        document.querySelector("#createBtn").style.display = "block";
        await populateAllAuctions();
        document.querySelector(".allAuctions").style.display = "flex";
    }

    document.querySelector("#button1").style.backgroundColor = "#D2D1D1";
    document.querySelector("#button2").style.backgroundColor = "#e4e4e4";
    document.querySelector("#button3").style.backgroundColor = "#e4e4e4";
    document.querySelector(".navigation").style.display = "flex";
    document.querySelector(".loading").style.display = "none";
}

async function populateAllAuctions() {
    var auctions = await getAllAuctions();
    
    var allAuctions = document.querySelector(".allAuctions");
    allAuctions.replaceChildren();
    var auctionCount = allAuctions.getElementsByClassName("auctionContainer").length;

    for(const auction of auctions.auctions) {
        if(auction.data.state != "Done") {
            var auctionContainer = document.createElement("div");
            auctionContainer.className = "auctionContainer";
            auctionContainer.id = auction.data.auction_id + "AllContainer";
            allAuctions.appendChild(auctionContainer);

            var imageContainer = document.createElement("span");
            imageContainer.className = "imageContainer";
            auctionContainer.appendChild(imageContainer);

            var auctionImage = document.createElement("img");
            auctionImage.className = "auctionImage";
            auctionImage.src = auction.data.image
            auctionImage.alt = "Auction image";
            imageContainer.appendChild(auctionImage);

            var otherContainer = document.createElement("span");
            otherContainer.style.flex = "1";
            otherContainer.style.height = "100%";
            auctionContainer.appendChild(otherContainer);

            var titleContainer = document.createElement("div");
            titleContainer.className = "titleContainer";
            titleContainer.style.display = "flex";
            titleContainer.style.alignItems = "center";
            titleContainer.style.justifyContent = "center";
            titleContainer.style.width = "100%";
            titleContainer.style.height = "20%";
            titleContainer.innerText = auction.data.title;
            otherContainer.appendChild(titleContainer);

            var otherDiv = document.createElement("div");
            otherDiv.style.display = "flex";
            otherDiv.style.justifyContent = "space-evenly";
            otherDiv.style.width = "100%";
            otherDiv.style.height = "80%";
            otherContainer.appendChild(otherDiv);

            // left

            var leftInfoContainer = document.createElement("span");
            leftInfoContainer.className = "infoContainer";
            otherDiv.appendChild(leftInfoContainer);

            var para1 = document.createElement("p");
            para1.innerHTML = "<strong>" + auction.data.bathrooms + " BATHROOM(S)\n</strong>";
            leftInfoContainer.appendChild(para1);

            var para2 = document.createElement("p");
            para2.innerHTML = "<strong>" + auction.data.bedrooms + " BEDROOM(S)\n</strong>";
            leftInfoContainer.appendChild(para2);

            var para3 = document.createElement("p");
            para3.innerHTML = "<strong>" + auction.data.parking_spaces + " PARKING SPACE(S)\n</strong>";
            leftInfoContainer.appendChild(para3);

            var para4 = document.createElement("p");
            para4.style.maxWidth = "80%";
            para4.innerHTML = "<strong>LOCATION:</strong>" + auction.data.location;
            leftInfoContainer.appendChild(para4);

            // right

            var rightInfoContainer = document.createElement("span");
            rightInfoContainer.className = "infoContainer";
            otherDiv.appendChild(rightInfoContainer);

            var para5 = document.createElement("p");
            para5.innerHTML = "<strong>START DATE: </strong>" + auction.data.start_date;
            rightInfoContainer.appendChild(para5);

            var para6 = document.createElement("p");
            para6.innerHTML = "<strong>END DATE: </strong>" + auction.data.end_date;
            rightInfoContainer.appendChild(para6);

            var para7 = document.createElement("p");
            para7.innerHTML = "<strong>AMENITIES:</strong>" + auction.data.amenities;
            rightInfoContainer.appendChild(para7);

            // widgets

            var widgetContainer = document.createElement("span");
            widgetContainer.style.width = "180px";
            widgetContainer.style.height = "100%";
            widgetContainer.className = "widgetContainer";
            auctionContainer.appendChild(widgetContainer);

            var stateWidget = document.createElement("div");
            stateWidget.className = "widget";
            stateWidget.id = auction.data.auction_id + "AllState";
            if(auction.data.state == "Ongoing") { stateWidget.style.backgroundColor = "#90EE90"; }
            stateWidget.innerText = auction.data.state;
            widgetContainer.appendChild(stateWidget);

            var priceWidget = document.createElement("div");
            priceWidget.className = "widget";
            priceWidget.id = auction.data.auction_id + "allHighestWidget";
            priceWidget.innerText = "R"
            if(auction.data.highest_bid < auction.data.price) { priceWidget.innerText += auction.data.price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
            else { priceWidget.innerText += auction.data.highest_bid.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
            widgetContainer.appendChild(priceWidget);

            var sellerWidget = document.createElement("div");
            sellerWidget.className = "widget";
            sellerWidget.innerText = auctions.auctioneers[auctionCount];
            widgetContainer.appendChild(sellerWidget);

            var viewWidget = document.createElement("div");
            viewWidget.className = "widget";
            viewWidget.id = auction.data.auction_id + "AllView";
            viewWidget.style.backgroundColor = "#0096FF";
            viewWidget.style.cursor = "Pointer"
            viewWidget.innerText = "View";
            viewWidget.onclick = function() { loadView(auction.data.auction_id); };
            if(auction.data.state != "Ongoing") { viewWidget.style.display = "none"; }
            widgetContainer.appendChild(viewWidget);
        }

        auctionCount++;
    }

    if(allAuctions.getElementsByClassName("auctionContainer").length == 0) {
        document.querySelector(".empty").style.display = "block";
    }else {
        document.querySelector(".empty").style.display = "none";
    }
}

async function loadMyAuctions() {
    if(localStorage.getItem("apikey") == null) {
        document.querySelector(".myAuctions").style.display = "none";
        document.querySelector(".allAuctions").style.display = "none";
        document.querySelector(".myWins").style.display = "none";
        document.querySelector(".viewAuction").style.display = "none";
        document.querySelector(".login-to-view").style.display = "block";
        document.querySelector(".user-info").style.display = "none";
        document.querySelector(".login-register").style.display = "flex";
        document.querySelector("#createBtn").style.display = "none";
    }else {
        document.querySelector(".loading").style.display = "flex";
        document.querySelector(".myAuctions").style.display = "none";
        document.querySelector(".allAuctions").style.display = "none";
        document.querySelector(".myWins").style.display = "none";
        document.querySelector(".viewAuction").style.display = "none";
        document.querySelector(".login-to-view").style.display = "none";
        document.querySelector(".user-info").style.display = "flex";
        document.querySelector(".login-register").style.display = "none";
        document.querySelector("#createBtn").style.display = "block";
        await populateMyAuctions();
        document.querySelector(".myAuctions").style.display = "flex";
    }

    document.querySelector("#button1").style.backgroundColor = "#e4e4e4";
    document.querySelector("#button2").style.backgroundColor = "#D2D1D1";
    document.querySelector("#button3").style.backgroundColor = "#e4e4e4";
    document.querySelector(".navigation").style.display = "flex";
    document.querySelector(".loading").style.display = "none";
}

async function populateMyAuctions() {
    var auctions = await getAllAuctions();

    var allAuctions = document.querySelector(".myAuctions");
    allAuctions.replaceChildren();
    var auctionCount = allAuctions.getElementsByClassName("auctionContainer").length;

    for(const auction of auctions.auctions) {
        if(auction.data.auctioneer_id == localStorage.getItem("uid")) {
            var auctionContainer = document.createElement("div");
            auctionContainer.className = "auctionContainer";
            auctionContainer.id = auction.data.auction_id + "MyContainer";
            allAuctions.appendChild(auctionContainer);

            var imageContainer = document.createElement("span");
            imageContainer.className = "imageContainer";
            auctionContainer.appendChild(imageContainer);

            var auctionImage = document.createElement("img");
            auctionImage.className = "auctionImage";
            auctionImage.src = auction.data.image
            auctionImage.alt = "Auction image";
            imageContainer.appendChild(auctionImage);

            var otherContainer = document.createElement("span");
            otherContainer.style.flex = "1";
            otherContainer.style.height = "100%";
            auctionContainer.appendChild(otherContainer);

            var titleContainer = document.createElement("div");
            titleContainer.className = "titleContainer";
            titleContainer.style.display = "flex";
            titleContainer.style.alignItems = "center";
            titleContainer.style.justifyContent = "center";
            titleContainer.style.width = "100%";
            titleContainer.style.height = "20%";
            titleContainer.innerText = auction.data.title;
            otherContainer.appendChild(titleContainer);

            var otherDiv = document.createElement("div");
            otherDiv.style.display = "flex";
            otherDiv.style.justifyContent = "space-evenly";
            otherDiv.style.width = "100%";
            otherDiv.style.height = "80%";
            otherContainer.appendChild(otherDiv);

            // left

            var leftInfoContainer = document.createElement("span");
            leftInfoContainer.className = "infoContainer";
            otherDiv.appendChild(leftInfoContainer);

            var para1 = document.createElement("p");
            para1.innerHTML = "<strong>" + auction.data.bathrooms + " BATHROOM(S)\n</strong>";
            leftInfoContainer.appendChild(para1);

            var para2 = document.createElement("p");
            para2.innerHTML = "<strong>" + auction.data.bedrooms + " BEDROOM(S)\n</strong>";
            leftInfoContainer.appendChild(para2);

            var para3 = document.createElement("p");
            para3.innerHTML = "<strong>" + auction.data.parking_spaces + " PARKING SPACE(S)\n</strong>";
            leftInfoContainer.appendChild(para3);

            var para4 = document.createElement("p");
            para4.style.maxWidth = "80%";
            para4.innerHTML = "<strong>LOCATION:</strong>" + auction.data.location;
            leftInfoContainer.appendChild(para4);

            // right

            var rightInfoContainer = document.createElement("span");
            rightInfoContainer.className = "infoContainer";
            otherDiv.appendChild(rightInfoContainer);

            var para5 = document.createElement("p");
            para5.innerHTML = "<strong>START DATE: </strong>" + auction.data.start_date;
            rightInfoContainer.appendChild(para5);

            var para6 = document.createElement("p");
            para6.innerHTML = "<strong>END DATE: </strong>" + auction.data.end_date;
            rightInfoContainer.appendChild(para6);

            var para7 = document.createElement("p");
            para7.innerHTML = "<strong>AMENITIES:</strong>" + auction.data.amenities;
            rightInfoContainer.appendChild(para7);

            // widgets

            var widgetContainer = document.createElement("span");
            widgetContainer.style.width = "180px";
            widgetContainer.style.height = "100%";
            widgetContainer.className = "widgetContainer";
            auctionContainer.appendChild(widgetContainer);

            var stateWidget = document.createElement("div");
            stateWidget.className = "widget";
            stateWidget.id = auction.data.auction_id + "MyState";
            if(auction.data.state == "Ongoing") { stateWidget.style.backgroundColor = "#90EE90"; }
            if(auction.data.state == "Done") { stateWidget.style.backgroundColor = "#FFD700"; }
            stateWidget.innerText = auction.data.state;
            widgetContainer.appendChild(stateWidget);

            var priceWidget = document.createElement("div");
            priceWidget.className = "widget";
            priceWidget.id = auction.data.auction_id + "myHighestWidget";
            priceWidget.innerText = "R"
            if(auction.data.highest_bid < auction.data.price) { priceWidget.innerText += auction.data.price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
            else { priceWidget.innerText += auction.data.highest_bid.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
            widgetContainer.appendChild(priceWidget);

            var cancelWidget = document.createElement("div");
            cancelWidget.className = "widget";
            cancelWidget.id = auction.data.auction_id + "myCancel";
            cancelWidget.style.backgroundColor = "#FF3131";
            cancelWidget.innerText = "Cancel";
            widgetContainer.appendChild(cancelWidget);

            if(auction.data.state != "Done") {
                cancelWidget.style.cursor = "Pointer";
                cancelWidget.onclick = function() { cancelAuction(auction.data.auction_id); };
            }else {
                cancelWidget.style.cursor = "not-allowed";
            }

            var viewWidget = document.createElement("div");
            viewWidget.className = "widget";
            viewWidget.style.backgroundColor = "#0096FF";
            viewWidget.style.cursor = "Pointer"
            viewWidget.innerText = "View";
            viewWidget.onclick = function() { loadView(auction.data.auction_id); };
            widgetContainer.appendChild(viewWidget);
        }

        auctionCount++;
    }

    if(allAuctions.getElementsByClassName("auctionContainer").length == 0) {
        document.querySelector(".empty").style.display = "block";
    }else {
        document.querySelector(".empty").style.display = "none";
    }
}

async function loadMyWins() {
    if(localStorage.getItem("apikey") == null) {
        document.querySelector(".myWins").style.display = "none";
        document.querySelector(".allAuctions").style.display = "none";
        document.querySelector(".myAuctions").style.display = "none";
        document.querySelector(".viewAuction").style.display = "none";
        document.querySelector(".login-to-view").style.display = "block";
        document.querySelector(".user-info").style.display = "none";
        document.querySelector(".login-register").style.display = "flex";
        document.querySelector("#createBtn").style.display = "none";
    }else {
        document.querySelector(".myWins").style.display = "none";
        document.querySelector(".allAuctions").style.display = "none";
        document.querySelector(".myAuctions").style.display = "none";
        document.querySelector(".viewAuction").style.display = "none";
        document.querySelector(".loading").style.display = "block";
        document.querySelector(".login-to-view").style.display = "none";
        document.querySelector(".user-info").style.display = "flex";
        document.querySelector(".login-register").style.display = "none";
        document.querySelector("#createBtn").style.display = "block";
        await populateMyWins();
        document.querySelector(".myWins").style.display = "flex";
    }

    document.querySelector("#button1").style.backgroundColor = "#e4e4e4";
    document.querySelector("#button2").style.backgroundColor = "#e4e4e4";
    document.querySelector("#button3").style.backgroundColor = "#D2D1D1";
    document.querySelector(".navigation").style.display = "flex";
    document.querySelector(".loading").style.display = "none";
}

async function populateMyWins() {
    var auctions = await getAllAuctions();

    var myWins = document.querySelector(".myWins");
    myWins.replaceChildren();
    var auctionCount = myWins.getElementsByClassName("auctionContainer").length;

    for(const auction of auctions.auctions) {
        if(auction.data.buyer_id == localStorage.getItem("uid")) {
            var auctionContainer = document.createElement("div");
            auctionContainer.className = "auctionContainer";
            auctionContainer.id = auction.data.auction_id + "MyContainer";
            myWins.appendChild(auctionContainer);

            var imageContainer = document.createElement("span");
            imageContainer.className = "imageContainer";
            auctionContainer.appendChild(imageContainer);

            var auctionImage = document.createElement("img");
            auctionImage.className = "auctionImage";
            auctionImage.src = auction.data.image
            auctionImage.alt = "Auction image";
            imageContainer.appendChild(auctionImage);

            var otherContainer = document.createElement("span");
            otherContainer.style.flex = "1";
            otherContainer.style.height = "100%";
            auctionContainer.appendChild(otherContainer);

            var titleContainer = document.createElement("div");
            titleContainer.className = "titleContainer";
            titleContainer.style.display = "flex";
            titleContainer.style.alignItems = "center";
            titleContainer.style.justifyContent = "center";
            titleContainer.style.width = "100%";
            titleContainer.style.height = "20%";
            titleContainer.innerText = auction.data.title;
            otherContainer.appendChild(titleContainer);

            var otherDiv = document.createElement("div");
            otherDiv.style.display = "flex";
            otherDiv.style.justifyContent = "space-evenly";
            otherDiv.style.width = "100%";
            otherDiv.style.height = "80%";
            otherContainer.appendChild(otherDiv);

            // left

            var leftInfoContainer = document.createElement("span");
            leftInfoContainer.className = "infoContainer";
            otherDiv.appendChild(leftInfoContainer);

            var para1 = document.createElement("p");
            para1.innerHTML = "<strong>" + auction.data.bathrooms + " BATHROOM(S)\n</strong>";
            leftInfoContainer.appendChild(para1);

            var para2 = document.createElement("p");
            para2.innerHTML = "<strong>" + auction.data.bedrooms + " BEDROOM(S)\n</strong>";
            leftInfoContainer.appendChild(para2);

            var para3 = document.createElement("p");
            para3.innerHTML = "<strong>" + auction.data.parking_spaces + " PARKING SPACE(S)\n</strong>";
            leftInfoContainer.appendChild(para3);

            var para4 = document.createElement("p");
            para4.style.maxWidth = "80%";
            para4.innerHTML = "<strong>LOCATION:</strong>" + auction.data.location;
            leftInfoContainer.appendChild(para4);

            // right

            var rightInfoContainer = document.createElement("span");
            rightInfoContainer.className = "infoContainer";
            otherDiv.appendChild(rightInfoContainer);

            var para5 = document.createElement("p");
            para5.innerHTML = "<strong>START DATE: </strong>" + auction.data.start_date;
            rightInfoContainer.appendChild(para5);

            var para6 = document.createElement("p");
            para6.innerHTML = "<strong>END DATE: </strong>" + auction.data.end_date;
            rightInfoContainer.appendChild(para6);

            var para7 = document.createElement("p");
            para7.innerHTML = "<strong>AMENITIES:</strong>" + auction.data.amenities;
            rightInfoContainer.appendChild(para7);

            // widgets

            var widgetContainer = document.createElement("span");
            widgetContainer.style.width = "180px";
            widgetContainer.style.height = "100%";
            widgetContainer.className = "widgetContainer";
            auctionContainer.appendChild(widgetContainer);

            var stateWidget = document.createElement("div");
            stateWidget.className = "widget";
            stateWidget.id = auction.data.auction_id + "MyState";
            if(auction.data.state == "Ongoing") { stateWidget.style.backgroundColor = "#90EE90"; }
            if(auction.data.state == "Done") { stateWidget.style.backgroundColor = "#FFD700"; }
            stateWidget.innerText = auction.data.state;
            widgetContainer.appendChild(stateWidget);

            var priceWidget = document.createElement("div");
            priceWidget.className = "widget";
            priceWidget.id = auction.data.auction_id + "myHighestWidget";
            priceWidget.innerText = "R"
            if(auction.data.highest_bid < auction.data.price) { priceWidget.innerText += auction.data.price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
            else { priceWidget.innerText += auction.data.highest_bid.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
            widgetContainer.appendChild(priceWidget);

            var viewWidget = document.createElement("div");
            viewWidget.className = "widget";
            viewWidget.style.backgroundColor = "#0096FF";
            viewWidget.style.cursor = "Pointer"
            viewWidget.innerText = "View";
            viewWidget.onclick = function() { loadView(auction.data.auction_id); };
            widgetContainer.appendChild(viewWidget);
        }

        auctionCount++;
    }

    if(myWins.getElementsByClassName("auctionContainer").length == 0) {
        document.querySelector(".empty").style.display = "block";
    }else {
        document.querySelector(".empty").style.display = "none";
    }
}

async function loadView(auction_id) {
    document.querySelector(".myWins").style.display = "none";
    document.querySelector(".allAuctions").style.display = "none";
    document.querySelector(".myAuctions").style.display = "none";
    document.querySelector(".viewAuction").style.display = "none";
    document.querySelector(".loading").style.display = "block";
    document.querySelector(".login-to-view").style.display = "none";
    document.querySelector(".user-info").style.display = "flex";
    document.querySelector(".login-register").style.display = "none";
    document.querySelector("#createBtn").style.display = "block";
    await populateView(auction_id);
    document.querySelector(".viewAuction").style.display = "flex";
    document.querySelector("#button1").style.backgroundColor = "#e4e4e4";
    document.querySelector("#button2").style.backgroundColor = "#e4e4e4";
    document.querySelector("#button3").style.backgroundColor = "#e4e4e4";
    document.querySelector(".navigation").style.display = "flex";
    document.querySelector(".loading").style.display = "none";
}

async function populateView(auction_id) {
    const auction = await getAuction(auction_id);

    var viewAuction = document.querySelector(".viewAuction");
    viewAuction.replaceChildren();

    var viewContainer = document.createElement("div");
    viewContainer.className = "viewContainer";
    viewAuction.appendChild(viewContainer);

    var mediaContainer = document.createElement("span");
    mediaContainer.style.display = "flex";
    mediaContainer.style.flexDirection = "column";
    mediaContainer.style.width = "320px";
    mediaContainer.style.height = "100%";
    mediaContainer.className = "mediaContainer";
    viewContainer.appendChild(mediaContainer);

    var imageContainer = document.createElement("span");
    imageContainer.style.display = "flex";
    imageContainer.style.justifyContent = "center";
    imageContainer.style.alignItems = "center";
    imageContainer.style.height = "50%";
    imageContainer.style.overflow = "hidden";
    mediaContainer.appendChild(imageContainer);

    var auctionImage = document.createElement("img");
    auctionImage.style.width = "100%";
    auctionImage.style.height = "100%";
    auctionImage.style.objectFit = "cover";
    auctionImage.style.objectPosition = "center";
    auctionImage.src = auction.auction.data.image;
    auctionImage.alt = "Auction image";
    imageContainer.appendChild(auctionImage);

    var auctionLocation = document.createElement("span");
    auctionLocation.style.height = "50%";
    auctionLocation.className = "auctionLocation";
    auctionLocation.id = "map";
    mediaContainer.appendChild(auctionLocation);

    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + auction.auction.data.location + ', South Africa')
    .then(function(response) {return response.json();})
    .then(function(data) {
        if (data.length > 0) {
        var lat = data[0].lat;
        var lon = data[0].lon;

        var map = L.map('map').setView([lat, lon], 13);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        L.marker([lat, lon]).addTo(map)
            .bindPopup(auction.auction.data.location + ", South Africa")
            .openPopup();
        } else {
            console.error('Location not found');
        }
    }).catch(function(error) {
        console.error('Error fetching geolocation:', error);
    });

    var detailContainer = document.createElement("span");
    detailContainer.style.display = "flex";
    detailContainer.style.flexDirection = "column";
    detailContainer.style.height = "100%";
    detailContainer.style.flex = "1";
    detailContainer.style.paddingBottom = "20px";
    detailContainer.style.boxSizing = "border-box";
    detailContainer.className = "detailContainer";
    viewContainer.appendChild(detailContainer);

    var titleContainer = document.createElement("div");
    titleContainer.className = "titleContainer";
    titleContainer.style.display = "flex";
    titleContainer.style.alignItems = "center";
    titleContainer.style.justifyContent = "center";
    titleContainer.style.width = "100%";
    titleContainer.style.height = "10%";
    titleContainer.innerText = auction.auction.data.title;
    detailContainer.appendChild(titleContainer);

    var otherDiv = document.createElement("div");
    otherDiv.style.display = "flex";
    otherDiv.style.justifyContent = "space-evenly";
    otherDiv.style.width = "100%";
    detailContainer.appendChild(otherDiv);

    // left

    var leftInfoContainer = document.createElement("span");
    leftInfoContainer.className = "infoContainer";
    otherDiv.appendChild(leftInfoContainer);

    var para1 = document.createElement("p");
    para1.innerHTML = "<strong>" + auction.auction.data.bathrooms + " BATHROOM(S)\n</strong>";
    leftInfoContainer.appendChild(para1);

    var para2 = document.createElement("p");
    para2.innerHTML = "<strong>" + auction.auction.data.bedrooms + " BEDROOM(S)\n</strong>";
    leftInfoContainer.appendChild(para2);

    var para3 = document.createElement("p");
    para3.innerHTML = "<strong>" + auction.auction.data.parking_spaces + " PARKING SPACE(S)\n</strong>";
    leftInfoContainer.appendChild(para3);

    var para4 = document.createElement("p");
    para4.style.maxWidth = "80%";
    para4.innerHTML = "<strong>LOCATION:</strong>" + auction.auction.data.location;
    leftInfoContainer.appendChild(para4);

    // right

    var rightInfoContainer = document.createElement("span");
    rightInfoContainer.className = "infoContainer";
    otherDiv.appendChild(rightInfoContainer);

    var para5 = document.createElement("p");
    para5.innerHTML = "<strong>START DATE: </strong>" + auction.auction.data.start_date;
    rightInfoContainer.appendChild(para5);

    var para6 = document.createElement("p");
    para6.innerHTML = "<strong>END DATE: </strong>" + auction.auction.data.end_date;
    rightInfoContainer.appendChild(para6);

    var para7 = document.createElement("p");
    para7.innerHTML = "<strong>AMENITIES:</strong>" + auction.auction.data.amenities;
    rightInfoContainer.appendChild(para7);

    var descContainer = document.createElement("div");
    descContainer.style.width = "100%";
    descContainer.style.flex = "1";
    descContainer.className = "descContainer";
    detailContainer.appendChild(descContainer);

    var descTitleContainer = document.createElement("div");
    descTitleContainer.style.display = "flex";
    descTitleContainer.style.alignItems = "center";
    descTitleContainer.style.justifyContent = "center";
    descTitleContainer.style.width = "100%";
    descTitleContainer.style.height = "10%";
    descTitleContainer.className = "titleContainer";
    descTitleContainer.innerText = "Description";
    descContainer.appendChild(descTitleContainer);

    var descBodyContainer = document.createElement("p");
    descBodyContainer.style.display = "flex";
    descBodyContainer.style.alignItems = "center";
    descBodyContainer.style.width = "100%";
    descBodyContainer.style.alignItems = "center";
    descBodyContainer.className = "infoContainer";
    descBodyContainer.innerText = auction.auction.data.description;
    descContainer.appendChild(descBodyContainer);

    var widgetContainer = document.createElement("div");
    widgetContainer.style.width = "100%";
    widgetContainer.style.height = "60px";
    widgetContainer.style.flexDirection = "row";
    widgetContainer.className = "widgetContainer";
    detailContainer.appendChild(widgetContainer);

    function createWidgetWithLabel(container, labelText, widgetContent, widgetId = "", widgetClass = "widget") {
        var wrapper = document.createElement("span");
        wrapper.className = "widgetWrapper";
        container.appendChild(wrapper);

        var label = document.createElement("span");
        label.className = "label";
        label.innerText = labelText;
        wrapper.appendChild(label);

        var widget = document.createElement("span");
        widget.className = widgetClass;
        if (widgetId) widget.id = widgetId;
        widget.innerText = widgetContent;
        wrapper.appendChild(widget);
    }

    createWidgetWithLabel(widgetContainer, "State", auction.auction.data.state, auction_id + "ViewState", "widget");
    if (auction.auction.data.state == "Ongoing") { 
        document.getElementById(auction_id + "ViewState").style.backgroundColor = "#90EE90"; 
    }
    if (auction.auction.data.state == "Done") { 
        document.getElementById(auction_id + "ViewState").style.backgroundColor = "#FFD700"; 
    }

    createWidgetWithLabel(widgetContainer, "Auctioneer", auction.user, "", "widget");

    createWidgetWithLabel(widgetContainer, "Base Price", "R" + auction.auction.data.price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " "), "", "widget");

    var bidContainer = document.createElement("span");
    bidContainer.style.display = "flex";
    bidContainer.style.flexDirection = "column";
    bidContainer.style.width = "300px";
    bidContainer.style.height = "100%";
    bidContainer.style.backgroundColor = "#D2D1D1";
    bidContainer.className = "bidContainer";
    viewContainer.appendChild(bidContainer);

    var highestContainer = document.createElement("div");
    highestContainer.style.display = "flex";
    highestContainer.style.alignItems = "center";
    highestContainer.style.justifyContent = "space-evenly";
    highestContainer.style.width = "100%";
    highestContainer.style.height = "90px";
    highestContainer.style.paddingBottom = "20px";
    highestContainer.style.paddingTop = "20px";
    highestContainer.style.boxSizing = "border-box";
    highestContainer.className = "highestContainer";
    bidContainer.appendChild(highestContainer);

    var highestText = document.createElement("p");
    highestText.style.display = "flex";
    highestText.style.alignItems = "center";
    highestText.style.alignContent = "center";
    highestText.style.width = "100px";
    highestText.style.textAlign = "center";
    highestText.innerText = "Highest Bid";
    highestText.className = "text";
    highestContainer.appendChild(highestText);

    var highestWidget = document.createElement("div");
    highestWidget.style.backgroundColor = "#e4e4e4";
    highestWidget.style.width = "160px";
    highestWidget.innerText = "R" + auction.auction.data.highest_bid.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    highestWidget.className = "widget";
    highestWidget.id = auction_id + "viewHighestWidget";
    highestContainer.appendChild(highestWidget);

    var historyContainer = document.createElement("div");
    historyContainer.style.display = "flex";
    historyContainer.style.flexDirection = "column";
    historyContainer.style.backgroundColor = "#e4e4e4";
    historyContainer.style.borderRadius = "20px";
    historyContainer.style.width = "90%";
    historyContainer.style.flex = "1";
    historyContainer.style.marginLeft = "5%";
    historyContainer.style.marginRight = "5%";
    historyContainer.style.boxSizing = "border-box";
    historyContainer.style.padding = "10px";
    historyContainer.style.overflowY = "scroll";
    historyContainer.innerHTML = auction.history;
    historyContainer.className = "text";
    historyContainer.id = auction_id + "historyContainer";
    bidContainer.appendChild(historyContainer);

    var placeBidContainer = document.createElement("div");
    placeBidContainer.style.display = "flex";
    placeBidContainer.style.alignItems = "center";
    placeBidContainer.style.justifyContent = "space-evenly";
    placeBidContainer.style.width = "100%";
    placeBidContainer.style.height = "90px";
    placeBidContainer.style.paddingBottom = "20px";
    placeBidContainer.style.paddingTop = "20px";
    placeBidContainer.style.boxSizing = "border-box";
    placeBidContainer.className = "placeBidContainer";
    bidContainer.appendChild(placeBidContainer);

    var placeBidInput = document.createElement("input");
    placeBidInput.style.padding = "6px";
    placeBidInput.style.border = "none";
    placeBidInput.style.fontSize = "20px";
    placeBidInput.style.borderRadius = "20px";
    placeBidInput.style.width = "180px";
    placeBidInput.style.height = "38px";
    placeBidInput.placeholder = "eg. 50 000";
    placeBidInput.className = "text";
    placeBidInput.id = "placeBid";
    placeBidInput.name = "placeBid";
    placeBidContainer.appendChild(placeBidInput);

    placeBidInput.addEventListener("input", function (event) {
        var value = event.target.value.replace(/\s|R/g, '');
        var parts = value.toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        event.target.value = "R" + parts.join(".");
    });

    var placeBidBtn = document.createElement("div");
    placeBidBtn.style.display = "flex";
    placeBidBtn.style.alignItems = "center";
    placeBidBtn.style.justifyContent = "center";
    placeBidBtn.style.backgroundColor = "#0096FF";
    placeBidBtn.style.borderRadius = "20px";
    placeBidBtn.style.width = "50px";
    placeBidBtn.style.height = "50px";
    placeBidBtn.innerHTML = "<img src='img/send.png' width=30 height=30>";
    placeBidBtn.className = "text";
    placeBidBtn.id = auction_id + "placeBid";
    placeBidContainer.appendChild(placeBidBtn);

    if(auction.auction.data.auctioneer_id != localStorage.getItem("uid") && auction.auction.data.state != "Done") {
        placeBidBtn.style.cursor = "Pointer";
        placeBidBtn.onclick = function() { placeBid(auction.auction.data.auction_id, localStorage.getItem("uid"), placeBidInput.value); placeBidInput.value = ""; };
    }else {
        placeBidBtn.style.cursor = "not-allowed";
    }
    
}

function placeBid(auction_id, user_id, value) {
    value = Number(value.replace(/\s|R/g, ''));

    if (isNaN(value)) {
        addNotification("Attention!", "Invalid bid!");
        return;
    }
    
    socket.emit("bid", auction_id + "," + user_id + "," + value);
}

function createAuction(event) {
    event.preventDefault();

    if(new Date().setMinutes(new Date().getMinutes() - 1) >= new Date(document.querySelector('input[name="createAuctionStart"]').value)) {
        addNotification("Attention!", "Start date cannot be in the past!");
        return;
    }

    if(new Date(document.querySelector('input[name="createAuctionStart"]').value) >= new Date(document.querySelector('input[name="createAuctionEnd"]').value)) {
        addNotification("Attention!", "End date must be after start date!");
        return;
    }

    price = Number(document.querySelector('input[name="createAuctionPrice"]').value.replace(/\s|R/g, ''));

    if (isNaN(price)) {
        addNotification("Attention!", "Invalid price!");
        return;
    }

    var amenities = "None";

    if(document.querySelector('input[name="createAuctionAmenities1"]').value != "") {
        if(amenities == "None") {
            amenities = document.querySelector('input[name="createAuctionAmenities1"]').value;
        }else {
            amenities += "<br>" + document.querySelector('input[name="createAuctionAmenities1"]').value;
        }
    }
    
    if(document.querySelector('input[name="createAuctionAmenities2"]').value != "") {
        if(amenities == "None") {
            amenities = document.querySelector('input[name="createAuctionAmenities2"]').value;
        }else {
            amenities += "<br>" + document.querySelector('input[name="createAuctionAmenities2"]').value;
        }
    }

    if(document.querySelector('input[name="createAuctionAmenities3"]').value != "") {
        if(amenities == "None") {
            amenities = document.querySelector('input[name="createAuctionAmenities3"]').value;
        }else {
            amenities += "<br>" + document.querySelector('input[name="createAuctionAmenities3"]').value;
        }
    }

    if(document.querySelector('input[name="createAuctionAmenities4"]').value != "") {
        if(amenities == "None") {
            amenities = document.querySelector('input[name="createAuctionAmenities4"]').value;
        }else {
            amenities += "<br>" + document.querySelector('input[name="createAuctionAmenities4"]').value;
        }
    }

    if(document.querySelector('input[name="createAuctionAmenities5"]').value != "") {
        if(amenities == "None") {
            amenities = document.querySelector('input[name="createAuctionAmenities5"]').value;
        }else {
            amenities += "<br>" + document.querySelector('input[name="createAuctionAmenities5"]').value;
        }
    }

    var auctionDetails = {
        apikey: localStorage.getItem("apikey"),
        auction_name: document.querySelector('input[name="createAuctionName"]').value,
        start_date: document.querySelector('input[name="createAuctionStart"]').value.replace("T", " ") + ":00",
        end_date: document.querySelector('input[name="createAuctionEnd"]').value.replace("T", " ") + ":00",
        title: document.querySelector('input[name="createAuctionTitle"]').value,
        price: price,
        location: document.querySelector('input[name="createAuctionLocation"]').value,
        bedrooms: document.querySelector('input[name="createAuctionBedrooms"]').value,
        bathrooms: document.querySelector('input[name="createAuctionBathrooms"]').value,
        parking_spaces: document.querySelector('input[name="createAuctionParking"]').value,
        amenities: amenities,
        description: document.querySelector('textarea[name="createAuctionDesc"]').value,
        auctioneer_id: localStorage.getItem("uid")
    };

    socket.emit("create", auctionDetails);

    if(document.querySelector('.createAuctionImage').src != "http://localhost:3000/img/addimage.png") {
        const base64String = document.querySelector('.createAuctionImage').src;
        const chunkSize = 100 * 1024;
        const totalChunks = Math.ceil(base64String.length / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
            const chunk = base64String.slice(i * chunkSize, (i + 1) * chunkSize);
            const chunkData = {
                apikey: localStorage.getItem("apikey"),
                chunk: chunk,
                chunkIndex: i,
                totalChunks: totalChunks
            };

            socket.emit("createAuctionImageChunk", chunkData);
        }
    }else {
        socket.emit("createAuctionNullImage");
    }

    popupContainer.style.display = 'none';
    createAuctionForm.style.display = 'none';

    addNotification("Congratulations!", "Auction created.")
}

function cancelAuction(auction_id) {
    socket.emit("stop", auction_id);
}

function getAllAuctions() {
    return new Promise((resolve, reject) => {
        socket.on("receiveAllAuctions", (auctions) => {
            resolve(auctions);
        });

        socket.on("error", (error) => {
            reject(error);
        });
    
        socket.emit("getAllAuctions");
    });
}

function getAuction(auction_id) {
    return new Promise((resolve, reject) => {
        socket.on("receiveAuction", (auction) => {
            resolve(auction);
        });

        socket.on("error", (error) => {
            reject(error);
        });
    
        socket.emit("getAuction", auction_id);
    });
}

/* FOR THE HEADER */

loginBtn.addEventListener('click', function() {
    popupContainer.style.display = 'block';
    loginForm.style.display = 'flex';
});

createAuctionBtn.addEventListener('click', function() {
    popupContainer.style.display = 'block';
    createAuctionForm.style.display = 'flex';
});

closePopupBtn.addEventListener('click', function() {
    popupContainer.style.display = 'none';
    loginForm.style.display = 'none';
    createAuctionForm.style.display = 'none';
});

popupContainer.addEventListener('click', function(event) {
    if (event.target === popupContainer) {
        popupContainer.style.display = 'none';
        loginForm.style.display = 'none';
        createAuctionForm.style.display = 'none';
    }
});

function submitLoginForm(event) {
    event.preventDefault();
    const loginInfo = new XMLHttpRequest();
    loginInfo.open("POST", "https://wheatley.cs.up.ac.za/u23547104/api.php", false);
    loginInfo.setRequestHeader('Content-Type', 'application/json');
    loginInfo.setRequestHeader('Authorization', `Basic ${btoa(`${window.env.API_USERNAME}:${window.env.API_PASSWORD}`)}`);

    var formData = {
        type: "Login",
        email: document.querySelector('input[name="login-email"]').value,
        password: document.querySelector('input[name="login-password"]').value
    };

    loginInfo.send(JSON.stringify(formData));
    var loginInfoJSON = JSON.parse(loginInfo.responseText);

    if(loginInfoJSON["status"] == "error") {
        alert(loginInfoJSON["data"]);
    }else {
        localStorage.setItem("apikey", loginInfoJSON["data"]["apikey"]);
        localStorage.setItem("picture", loginInfoJSON["data"]["picture"]);
        localStorage.setItem("name", loginInfoJSON["data"]["name"]);
        localStorage.setItem("surname", loginInfoJSON["data"]["surname"]);
        localStorage.setItem("uid", loginInfoJSON["data"]["id"]);
        localStorage.setItem("email", document.querySelector('input[name="login-email"]').value);
        location.reload();
    }
}

function setProfilePicture(event) {
    if (localStorage.getItem("apikey") != null) {
        const file = event.target.files[0];
        const reader = new FileReader();

        reader.onload = function (e) {
            const base64String = e.target.result;
            const chunkSize = 100 * 1024;
            const totalChunks = Math.ceil(base64String.length / chunkSize);

            for (let i = 0; i < totalChunks; i++) {
                const chunk = base64String.slice(i * chunkSize, (i + 1) * chunkSize);
                const chunkData = {
                    type: "SetPicture",
                    apikey: localStorage.getItem("apikey"),
                    chunk: chunk,
                    chunkIndex: i,
                    totalChunks: totalChunks
                };

                socket.emit("setPictureChunk", chunkData);
            }

            document.querySelector('.profile-img').src = base64String;
            localStorage.setItem("picture", base64String);
        };

        reader.readAsDataURL(file);
    }
}

function setAuctionPicture(event) {
    if (localStorage.getItem("apikey") != null) {
        const file = event.target.files[0];
        const reader = new FileReader();

        reader.onload = function (e) {
            const base64String = e.target.result;
            document.querySelector('.createAuctionImage').src = base64String;
        };

        reader.readAsDataURL(file);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var dropZone = document.getElementById('dropZone');
    var fileInput = document.getElementById('createAuctionImage');

    dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', function (e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        var files = e.dataTransfer.files;
        if (files.length) {
            fileInput.files = files;
            setAuctionPicture({ target: fileInput });
        }
    });
});

function logout() {
    localStorage.removeItem("apikey");
    localStorage.removeItem("picture");
    localStorage.removeItem("name");
    localStorage.removeItem("surname");
    localStorage.removeItem("uid");
    socket.disconnect();
    window.location.replace("index.html");
}

let notifications = [];
let isAnimating = false;

function addNotification(title, message) {
    const NotiElement = document.createElement("div");
    NotiElement.className = "stickyNotification";
    NotiElement.style.display = "block";
    NotiElement.style.position = "absolute";
    NotiElement.style.width = "290px";
    NotiElement.style.padding = "10px";
    NotiElement.style.borderRadius = "20px";
    NotiElement.style.backgroundColor = "#D2D1D1";
    NotiElement.style.left = "10px";
    NotiElement.style.top = "-100px";
    NotiElement.style.zIndex = "99999";

    const closeBtnId = "closeBtn_" + new Date().getTime();
    NotiElement.innerHTML = `<div><strong>${title}</strong></div><div>${message}</div><img id='${closeBtnId}' src='img/close.png' width='20'>`;

    document.body.appendChild(NotiElement);

    let topOffset = calculateTopOffset();

    NotiElement.style.top = topOffset + "px";
    NotiElement.style.transition = "top 0.5s ease-in-out";

    notifications.push(NotiElement);

    document.addEventListener("scroll", adjustNotifications);

    document.getElementById(closeBtnId).addEventListener("click", (event) => {
        removeNotification(NotiElement);
    });

    setTimeout(() => {
        removeNotification(NotiElement);
    }, 5000);
}

function calculateTopOffset() {
    let topOffset = 85;
    notifications.forEach(notification => {
        topOffset += notification.offsetHeight + 10;
    });
    return topOffset;
}

function adjustNotifications() {
    if (isAnimating) return;

    isAnimating = true;

    setTimeout(() => {
        let topOffset = 85;
        notifications.forEach(notification => {
            notification.style.top = topOffset + "px";
            topOffset += notification.offsetHeight + 10;
        });

        isAnimating = false;
    }, 100);
}

function removeNotification(NotiElement) {
    NotiElement.style.top = "-100px";
    NotiElement.style.transition = "top 0.5s ease-in-out";

    setTimeout(() => {
        if (document.body.contains(NotiElement)) {
            document.body.removeChild(NotiElement);
            notifications = notifications.filter(notification => notification !== NotiElement);
            adjustNotifications();
        }
    }, 500);
}

if(localStorage.getItem("picture") != null) {
    document.querySelector(".profile-img").src = localStorage.getItem("picture");
}

if(localStorage.getItem("name") != null) {
    document.querySelector(".username").innerText = localStorage.getItem("name");
}

document.querySelector('input[name="createAuctionPrice"]').addEventListener("input", function (event) {
    var value = event.target.value.replace(/\s|R/g, '');
    var parts = value.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    event.target.value = "R" + parts.join(".");
});