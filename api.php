<?php
require_once 'config.php';

class user {
    private $conn;
    
    public static function instance() {
        static $instance = null;
        if($instance === null) $instance = new user();
        return $instance;
    }

    private function __construct() {
        $this->conn = new mysqli(Config::$dbHost, Config::$dbUser, Config::$dbPass, Config::$dbName);

        if ($this->conn->connect_error) {
            http_response_code(500);
            die("Connection failed: " . $this->conn->connect_error);
        }
    }
    public function __destruct() {
        $this->conn->close();
    }

    public function registerUser($json){
        $requiredKeys = ['type', 'name', 'surname', 'email', 'password'];
        $missingKeys = array_diff($requiredKeys, array_keys($json));
        $missingValues = getMissingValues($json);

        if (empty($missingKeys) && empty($missingValues)) {
            if(!preg_match('/^(?:[a-z0-9!#$%&\'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&\'*+\/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i', $json['email'])) {
                http_response_code(400);
                die(createErrorResponse("Email address invalid!"));
            }

            if(!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/', $json['password'])) {
                http_response_code(400);
                die(createErrorResponse("Password invalid! Your password should have atleast 8 characters, contain upper and lower case letters, at least one digit and one symbol."));
            }

            if(preg_match('/^(?:[a-z0-9!#$%&\'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&\'*+\/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i', $json['email']) && preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/', $json['password'])) {
                $hash = hashPassword($json['password']);
                $key = $this->generateAPI();
                $this->insertUser($json['name'], $json['surname'], $json['email'], $hash['password'], $hash['salt'], $key);

                echo json_encode(array(
                    "status" => "success",
                    "timestamp" => floor(microtime(true) * 1000),
                    "data" => Array("apikey" => $key)));
            }
        }else if(!empty($missingValues)){
            http_response_code(400);
            die(createErrorResponse("The following values are missing: " . implode(', ', $missingValues)));
        }else {
            http_response_code(400);
            die(createErrorResponse("The following keys are missing: " . implode(', ', $missingKeys)));
        }
    }

    public function generateAPI(){
        $randomBytes = random_bytes(16);
        $apiKey = bin2hex($randomBytes);

        return $apiKey;
    }

    public function insertUser($name, $surname, $email, $password, $salt, $key) {
        $checkQuery = "SELECT COUNT(*) as count FROM users WHERE email = ?";
        $stmt = $this->conn->prepare($checkQuery);
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result && $result->num_rows > 0) {
            $row = $result->fetch_assoc();

            if ($row['count'] > 0) {
                http_response_code(409);
                die(createErrorResponse("Email address already exists"));
            }
        }

        $insertQuery = "INSERT INTO users (name, surname, email, password, salt, API_key) VALUES (?, ?, ?, ?, ?, ?)";
        $stmt = $this->conn->prepare($insertQuery);
        $stmt->bind_param("ssssss", $name, $surname, $email, $password, $salt, $key);

        if ($stmt->execute() === FALSE) {
            http_response_code(500);
            die(createErrorResponse($insertQuery . "<br>" . $stmt->error));
        }
    }

    function loginUser($email, $password) {
        $checkQuery = "SELECT id, name, surname, picture, password, salt, API_key, theme, search, type, sort_order, sort, bathrooms, bedrooms, price_min, price_max, favourites from users WHERE email = ?;";
        $stmt = $this->conn->prepare($checkQuery);
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if($result->num_rows == 0) {
            http_response_code(401);
            die(createErrorResponse("Email not found."));
        }

        $temp = $result->fetch_assoc();
        $hashedPassword = $temp["password"];
        $salt = $temp["salt"];

        if(hash('sha256', $password . $salt) == $hashedPassword) {
            $id = $temp["id"];
            $name = $temp["name"];
            $surname = $temp["surname"];
            $picture = $temp["picture"];
            $apikey = $temp["API_key"];
            $theme = $temp["theme"];
            $search = $temp["search"];
            $type = $temp["type"];
            $order = $temp["sort_order"];
            $sort = $temp["sort"];
            $bathrooms = $temp["bathrooms"];
            $bedrooms = $temp["bedrooms"];
            $price_min = $temp["price_min"];
            $price_max = $temp["price_max"];
            $favourites = $temp["favourites"];

            echo json_encode(array(
                "status" => "success",
                "timestamp" => floor(microtime(true) * 1000),
                "data" => array("id" => $id,
                                "name" => $name,
                                "surname" => $surname,
                                "picture" => $picture,      
                                "apikey" => $apikey,
                                "theme" => $theme,
                                "search" => $search,
                                "type" => $type,
                                "order" => $order,
                                "sort" => $sort,
                                "bathrooms" => $bathrooms,
                                "bedrooms" => $bedrooms,
                                "price_min" => $price_min,
                                "price_max" => $price_max,
                                "favourites" => $favourites)));
        }else {
            http_response_code(401);
            die(createErrorResponse("Incorrect password."));
        }
    }

    function setTheme($apikey, $theme) {
        checkApiKey($apikey, $this->conn);
        $checkQuery = "UPDATE users SET theme = ? WHERE API_key = ?;";
        $stmt = $this->conn->prepare($checkQuery);
        $stmt->bind_param("ss", $theme, $apikey);
        $stmt->execute();

        echo json_encode(array(
            "status" => "success",
            "timestamp" => floor(microtime(true) * 1000),
            "data" => array("apikey" => $apikey,
                            "theme" => $theme)));
    }

    function setPicture($apikey, $picture) {
        checkApiKey($apikey, $this->conn);
        $checkQuery = "UPDATE users SET picture = ? WHERE API_key = ?;";
        $stmt = $this->conn->prepare($checkQuery);
        $stmt->bind_param("ss", $picture, $apikey);
        
        if ($stmt->execute() === FALSE) {
            http_response_code(500);
            die(createErrorResponse("<br>" . $stmt->error));
        }

        echo json_encode(array(
            "status" => "success",
            "timestamp" => floor(microtime(true) * 1000),
            "data" => array("apikey" => $apikey,
                            "picture" => $picture)));
    }

    function setFilters($apikey, $search, $type, $order, $sort, $bathrooms, $bedrooms, $price_min, $price_max) {
        checkApiKey($apikey, $this->conn);
        $checkQuery = "UPDATE users SET search = ?, type = ?, sort_order = ?, sort = ?, bathrooms = ?, bedrooms = ?, price_min = ?, price_max = ? WHERE API_key = ?;";
        $stmt = $this->conn->prepare($checkQuery);
        $stmt->bind_param("ssssiidds", $search, $type, $order, $sort, $bathrooms, $bedrooms, $price_min, $price_max, $apikey);

        if ($stmt->execute() === FALSE) {
            http_response_code(500);
            die(createErrorResponse("<br>" . $stmt->error));
        }

        echo json_encode(array(
            "status" => "success",
            "timestamp" => floor(microtime(true) * 1000),
            "data" => array("apikey" => $apikey)));
    }

    function setFavourites($apikey, $favourites) {
        checkApiKey($apikey, $this->conn);
        $checkQuery = "UPDATE users SET favourites = ? WHERE API_key = ?;";
        $stmt = $this->conn->prepare($checkQuery);
        $stmt->bind_param("ss", $favourites, $apikey);
        
        if ($stmt->execute() === FALSE) {
            http_response_code(500);
            die(createErrorResponse("<br>" . $stmt->error));
        }

        echo json_encode(array(
            "status" => "success",
            "timestamp" => floor(microtime(true) * 1000),
            "data" => array("apikey" => $apikey)));
    }

    function getUsername($apikey, $id) {
        checkApiKey($apikey, $this->conn);
        $selectQuery = "SELECT name, surname FROM users WHERE id = ?;";
        $stmt = $this->conn->prepare($selectQuery);
        $stmt->bind_param("i", $id);

        if ($stmt->execute() === FALSE) {
            http_response_code(500);
            die(createErrorResponse("<br>" . $stmt->error));
        }

        $result = $stmt->get_result();

        if($result->num_rows == 0) {
            http_response_code(401);
            die(createErrorResponse("User ID not found."));
        }

        $assoc = $result->fetch_assoc();

        echo json_encode(array(
            "status" => "success",
            "timestamp" => floor(microtime(true) * 1000),
            "data" => $assoc["name"] . " " . $assoc["surname"]));
    }
}

function hashPassword($password) {
    $salt = bin2hex(random_bytes(6));
    $saltedPassword = $password . $salt;
    $hashedPassword = hash('sha256', $saltedPassword);

    return array(
        "password" => $hashedPassword,
        "salt" => $salt
    );
}

class listings {
    private $conn;

    public static function instance() {
        static $instance = null;
        if($instance === null) $instance = new listings();
        return $instance;
    }

    private function __construct() {
        $this->conn = new mysqli(Config::$dbHost, Config::$dbUser, Config::$dbPass, Config::$dbName);
        
        if ($this->conn->connect_error) {
            http_response_code(500);
            die(createErrorResponse("Connection failed: " . $this->conn->connect_error));
        }
    }
    public function __destruct() {
        $this->conn->close();
    }

    public function getListings($json) {
        $requiredKeys = ['apikey', 'type', 'return'];
        $missingKeys = array_diff($requiredKeys, array_keys($json));
        $missingValues = getMissingValues($json);

        if (empty($missingKeys) && empty($missingValues)) {
            checkApiKey($json['apikey'], $this->conn);
            $this->checkReturnKey($json['return']);
            $this->checkOptionalKeys($json);
            $this->buildAndExecuteQuery($json);
        }else if(!empty($missingValues)){
            http_response_code(400);
            die(createErrorResponse("The following values are missing: " . implode(', ', $missingValues)));
        }else {
            http_response_code(400);
            die(createErrorResponse("The following keys are missing: " . implode(', ', $missingKeys)));
        }
    }

    function checkOptionalKeys($json) {
        if(array_key_exists('limit', $json)) {
            if(!is_int($json['limit']) && isset($json['limit'])) {
                http_response_code(400);
                die(createErrorResponse("Limit must be an integer."));
            }

            if($json['limit'] < 1 || $json['limit'] > 500) {
                http_response_code(400);
                die(createErrorResponse("Limit must be between 1 and 500."));
            }
        }
        
        if(array_key_exists('sort', $json)) {
            if(!($json['sort'] == "id" || $json['sort'] == "title" || $json['sort'] == "location" || $json['sort'] == "price" || $json['sort'] == "bedrooms" || $json['sort'] == "bathrooms" || $json['sort'] == "parking_spaces" || $json['sort'] == null)) {
                http_response_code(400);
                die(createErrorResponse("Invalid sort value."));
            }
        }
        
        if(array_key_exists('order', $json)) {
            if(!($json['order'] == "ASC" || $json['order'] == "DESC")) {
                http_response_code(400);
                die(createErrorResponse("Invalid order value."));
            }

            if(!array_key_exists('sort', $json)) {
                http_response_code(400);
                die(createErrorResponse("Sort value required for order."));
            }
        }
        
        if(array_key_exists('fuzzy', $json)) {
            if(!is_bool($json['fuzzy'])) {
                http_response_code(400);
                die(createErrorResponse("Fuzzy must be a boolean."));
            }
        }
        
        if(array_key_exists('search', $json)) {
            $search = $json['search'];
            $keys = array_keys($search);
            $missingValues = getMissingValues($search);
            $allowedColumns = array('id', 'title', 'location', 'price_min', 'price_max', 'bedrooms', 'bathrooms', 'parking_spaces', 'amenities', 'type');

            if(empty($keys)) {
                http_response_code(400);
                die(createErrorResponse("Search must contain atleast 1 key."));
            }

            if(!empty($missingValues)) {
                http_response_code(400);
                die(createErrorResponse("The following search values are missing: " . implode(', ', $missingValues) . "."));
            }

            foreach ($keys as $column) {
                if(!in_array($column, $allowedColumns)) {
                    http_response_code(400);
                    die(createErrorResponse("Invalid search value: " . $column));
                }
            }

            if(array_key_exists('id', $search)) {
                if(!is_int($search['id'])) {
                    http_response_code(400);
                    die(createErrorResponse("ID must be an integer."));
                }
            }

            if(array_key_exists('title', $search)) {
                if(!is_string($search['title'])) {
                    http_response_code(400);
                    die(createErrorResponse("Title must be a string."));
                }
            }

            if(array_key_exists('location', $search)) {
                if(!is_string($search['location']) && $search['location'] != null) {
                    http_response_code(400);
                    die(createErrorResponse("Location must be a string."));
                }
            }

            if(array_key_exists('price_min', $search)) {
                if(!(is_int($search['price_min']) || is_float($search['price_min']) || $search['price_min'] == null)) {
                    http_response_code(400);
                    die(createErrorResponse("Price_min must be a number."));
                }
            }

            if(array_key_exists('price_max', $search)) {
                if(!(is_int($search['price_max']) || is_double($search['price_max']) || $search['price_max'] == null)) {
                    http_response_code(400);
                    die(createErrorResponse("Price_max must be a number."));
                }
            }

            if(array_key_exists('bedrooms', $search)) {
                if(!is_int($search['bedrooms']) && $search['bedrooms'] != null) {
                    http_response_code(400);
                    die(createErrorResponse("Bedrooms must be an integer."));
                }
            }

            if(array_key_exists('bathrooms', $search)) {
                if(!is_int($search['bathrooms'])  && $search['bathrooms'] != null) {
                    http_response_code(400);
                    die(createErrorResponse("Bathrooms must be an integer."));
                }
            }

            if(array_key_exists('parking_spaces', $search)) {
                if(!is_int($search['parking_spaces'])) {
                    http_response_code(400);
                    die(createErrorResponse("Parking_spaces must be an integer."));
                }
            }

            if(array_key_exists('amenities', $search)) {
                if(!is_string($search['amenities'])) {
                    http_response_code(400);
                    die(createErrorResponse("Amenities must be a string."));
                }
            }

            if(array_key_exists('type', $search)) {
                if(!($search['type'] == "sale" || $search['type'] == "rent")) {
                    http_response_code(400);
                    die(createErrorResponse("Invalid search type."));
                }
            }
        }
    }

    function buildAndExecuteQuery($json) {
        $search = $json['search'] ?? null;
        $return = $json['return'];
        $limit = $json['limit'] ?? null;
        $sort = $json['sort'] ?? null;
        $order = $json['order'] ?? null;
        $fuzzy = json_encode($json['fuzzy'] ?? null);
        $selectedColumns = array();
        $sql = "SELECT ";

        if($return === "*") {
            $sql .= "*";
        }else {
            foreach ($return as $column) {
                if($column != "images") {
                    $selectedColumns[] = $column;
                }
            }

            if(empty($selectedColumns)) { // only returning images
                $sql .= "id";
            }else if(!in_array("id", $selectedColumns)) { // id is not already returned
                $sql .= "id, " . implode(', ', $selectedColumns);
            }else { // id is already returned
                $sql .= implode(', ', $selectedColumns);
            }
        }

        $conditions = array();
        $params = array();
        $types = "";
        $sql .= " FROM listings WHERE ";
        $allowedColumns = array('id', 'title', 'location', 'price_min', 'price_max', 'bedrooms', 'bathrooms', 'parking_spaces', 'amenities', 'type');

        foreach ($allowedColumns as $column) {
            if (isset($search[$column])) {
                $params[] = $search[$column];

                if(is_int($search[$column])) {
                    if($column == 'price_min') {
                        $conditions[] = "price >= ?";
                        $types .= "i";
                    }else if ($column == 'price_max') {
                        $conditions[] = "price <= ?";
                        $types .= "i";
                    }else {
                        $conditions[] = "$column = ?";
                        $types .= "i";   
                    }
                }else if(is_float($search[$column])) {
                    $conditions[] = "$column = ?";
                    $types .= "d";
                }else {
                    if($fuzzy === "null" || $fuzzy === "true") {
                        $conditions[] = "$column LIKE CONCAT('%', ?, '%')";
                    }else {
                        $conditions[] = "$column = ?";
                    }

                    $types .= "s";
                }
            }
        }

        if (empty($conditions)) {
            $sql .= "1";
        }else {
            $sql .= implode(' AND ', $conditions);
        }

        if($sort != null) {
            $sql .= " ORDER BY " . $sort;

            if($order != null) {
                if($order == "ASC") {
                    $sql .= " ASC";
                }else {
                    $sql .= " DESC";
                }
            }
        }

        if($limit != null) {
            $sql .= " LIMIT ?";
            $params[] = $limit;
            $types .= "i";
        }else {
            $sql .= " LIMIT ?";
            $params[] = 10;
            $types .= "i";
        }

        $sql .= ";";
        $stmt = $this->conn->prepare($sql);
        if(!empty($params)) {
            $stmt->bind_param($types, ...$params);
        }

        if ($stmt->execute() === FALSE) {
            http_response_code(500);
            die(createErrorResponse($sql . "<br>" . $stmt->error));
        }

        $result = $stmt->get_result();
        $dataArray = array();

        while ($row = $result->fetch_assoc()) {
            $dataArray[] = $row;
        }

        if(in_array("images", $return)) {
            $ch = curl_init();

            foreach($dataArray as &$data) {
                curl_setopt($ch, CURLOPT_URL, "https://wheatley.cs.up.ac.za/api/getimage?listing_id=" . $data['id']);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                $data['images'] = json_decode(curl_exec($ch), true)['data'];
            }

            curl_close($ch);
        }

        if(!in_array("id", $return)) {
            foreach ($dataArray as &$data) {
                unset($data['id']);
            }
        }

        $dataArray = array_values($dataArray);

        echo json_encode(array(
            "status" => "success",
            "timestamp" => floor(microtime(true) * 1000),
            "data" => $dataArray));
    }

    function checkReturnKey($return) {
        if($return === "*") {

        }else if(is_array($return)) {
            $allowedColumns = array('id', 'title', 'location', 'price', 'bedrooms', 'bathrooms', 'url', 'parking_spaces', 'amenities', 'description', 'type', 'images');

            foreach ($return as $column) {
                if(!in_array($column, $allowedColumns)) {
                    http_response_code(400);
                    die(createErrorResponse("Invalid return value: " . $column));
                }
            }
        }else {
            http_response_code(400);
            die(createErrorResponse("Invalid return value."));
        }
    }
}

class auction {
    private $conn;

    public static function instance() {
        static $instance = null;
        if($instance === null) $instance = new auction();
        return $instance;
    }

    private function __construct() {
        $this->conn = new mysqli(Config::$dbHost, Config::$dbUser, Config::$dbPass, Config::$dbName);
        
        if ($this->conn->connect_error) {
            http_response_code(500);
            die(createErrorResponse("Connection failed: " . $this->conn->connect_error));
        }
    }
    public function __destruct() {
        $this->conn->close();
    }

    public function createAuction($json) {
        $requiredKeys = ['apikey', 'auction_id', 'auction_name', 'start_date', 'end_date', 'title', 'price', 'location', 'bathrooms', 'bedrooms', 'parking_spaces', 'description', 'auctioneer_id'];
        $allowedColumns = array('type', 'apikey', 'auction_id', 'auction_name', 'start_date', 'end_date', 'title', 'price', 'location', 'bathrooms', 'bedrooms', 'parking_spaces', 'amenities', 'description', 'image', 'auctioneer_id');
        $columns = array_keys($json);
        $missingKeys = array_diff($requiredKeys, array_keys($json));
        $missingValues = getMissingValues($json);

        foreach ($columns as $column) {
            if(!in_array($column, $allowedColumns)) {
                http_response_code(400);
                die(createErrorResponse("Invalid CreateAuction parameter: " . $column));
            }
        }

        if (empty($missingKeys) && empty($missingValues)) {
            $apikey = $json["apikey"];
            $id = $json["auction_id"];
            $name = $json["auction_name"];
            $start = $json["start_date"];
            $end = $json["end_date"];
            $title = $json["title"];
            $price = $json["price"];
            $location = $json["location"];
            $bathrooms = $json["bathrooms"];
            $bedrooms = $json["bedrooms"];
            $parking = $json["parking_spaces"];
            $amenities = $json["amenities"] ?? "None";
            $description = $json["description"];
            $image = $json["image"] ?? "data:image/png;base64,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";
            $auctioneer = $json["auctioneer_id"];

            checkApiKey($apikey, $this->conn);
            $this->checkInsertVariables($name, $start, $end, $title, $price, $location, $bathrooms, $bedrooms, $parking, $amenities, $description, $image, $auctioneer);

            $selectQuery = "SELECT auction_id FROM auctions WHERE auction_id = ?";
            $stmt = $this->conn->prepare($selectQuery);
            $stmt->bind_param("s", $id);

            if ($stmt->execute() === FALSE) {
                http_response_code(500);
                die(createErrorResponse($selectQuery . "<br>" . $stmt->error));
            }

            if($stmt->get_result()->num_rows != 0) {
                http_response_code(409);
                die(createErrorResponse("This auction already exists."));
            }

            $insertQuery = "INSERT INTO auctions (auction_id, auction_name, start_date, end_date, title, price, location, bedrooms, bathrooms, parking_spaces, amenities, description, image, auctioneer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
            $stmt = $this->conn->prepare($insertQuery);
            $stmt->bind_param("sssssdsiiisssi", $id, $name, $start, $end, $title, $price, $location, $bathrooms, $bedrooms, $parking, $amenities, $description, $image, $auctioneer);

            if ($stmt->execute() === FALSE) {
                http_response_code(500);
                die(createErrorResponse($insertQuery . "<br>" . $stmt->error));
            }

            echo json_encode(array(
                "status" => "success",
                "timestamp" => floor(microtime(true) * 1000),
                "data" => array("auction_id" => $id)));
        }else if(!empty($missingValues)){
            http_response_code(400);
            die(createErrorResponse("The following values are missing: " . implode(', ', $missingValues)));
        }else {
            http_response_code(400);
            die(createErrorResponse("The following keys are missing: " . implode(', ', $missingKeys)));
        }
    }

    function updateAuction($json) {
        $requiredKeys = ['apikey', 'auction_id'];
        $allowedColumns = array('type', 'apikey', 'auction_id', 'state', 'highest_bid', 'bid_history', 'buyer_id');
        $columns = array_keys($json);
        $missingKeys = array_diff($requiredKeys, array_keys($json));
        $missingValues = getMissingValues($json);

        foreach ($columns as $column) {
            if(!in_array($column, $allowedColumns)) {
                http_response_code(400);
                die(createErrorResponse("Invalid UpdateAuction parameter: " . $column));
            }
        }

        if (empty($missingKeys) && empty($missingValues)) {
            $apikey = $json["apikey"];
            $auction = $json["auction_id"];
            $state = $json["state"] ?? null;
            $highest = $json["highest_bid"] ?? null;
            $history = $json["bid_history"] ?? null;
            $buyer_id = $json["buyer_id"] ?? null;

            checkApiKey($apikey, $this->conn);
            $this->checkUpdateVariables($auction, $state, $highest, $history, $buyer_id);

            $selectedColumns = array();
            $sql = "UPDATE auctions SET ";
            $conditions = array();
            $types = "";

            if($state != null) {
                $selectedColumns[] = "state";
            }

            if($highest != null) {
                $selectedColumns[] = "highest_bid";
            }

            if($history != null) {
                $selectedColumns[] = "bid_history";
            }

            if($buyer_id != null) {
                $selectedColumns[] = "buyer_id";
            }

            foreach ($selectedColumns as $column) {
                $params[] = $json[$column];
                $conditions[] = "$column = ?";

                if(is_int($json[$column])) {
                    $types .= "i";   
                }else if(is_float($json[$column])) {
                    $types .= "d";
                }else {     
                    $types .= "s";
                }
            }

            if(empty($params)) {
                http_response_code(400);
                die(createErrorResponse("Select atleast one field to update."));
            }

            if($state == "Ongoing" || $state == "Waiting") {
                $params[] = $buyer_id;
                $conditions[] = "buyer_id = ?";
                $types .= "i";
            }

            $sql .= implode(', ', $conditions);
            $sql .= " WHERE auction_id = ?";
            $params[] = $auction;
            $types .= "s";
            $stmt = $this->conn->prepare($sql);
            $stmt->bind_param($types, ...$params);

            if ($stmt->execute() === FALSE) {
                http_response_code(500);
                die(createErrorResponse($sql . "<br>" . $stmt->error));
            }

            echo json_encode(array(
                "status" => "success",
                "timestamp" => floor(microtime(true) * 1000),
                "data" => array("auction_id" => $auction)));
        }else if(!empty($missingValues)){
            http_response_code(400);
            die(createErrorResponse("The following values are missing: " . implode(', ', $missingValues)));
        }else {
            http_response_code(400);
            die(createErrorResponse("The following keys are missing: " . implode(', ', $missingKeys)));
        }
    }

    function getAuction($json) {
        $requiredKeys = ['apikey', 'get_type'];
        $allowedColumns = array('type', 'apikey', 'get_type', 'auction_id');
        $columns = array_keys($json);
        $missingKeys = array_diff($requiredKeys, array_keys($json));
        $missingValues = getMissingValues($json);

        foreach ($columns as $column) {
            if(!in_array($column, $allowedColumns)) {
                http_response_code(400);
                die(createErrorResponse("Invalid GetAuction parameter: " . $column));
            }
        }

        if (empty($missingKeys) && empty($missingValues)) {
            $apikey = $json["apikey"];
            $type = $json["get_type"];
            $auction = $json["auction_id"] ?? null;

            checkApiKey($apikey, $this->conn);
            $this->checkGetVariables($type, $auction);

            if($type == "All") {
                $selectQuery = "SELECT auction_id, auction_name, title, bid_history, start_date, end_date, state, auctioneer_id FROM auctions;";
                $stmt = $this->conn->prepare($selectQuery);

                if ($stmt->execute() === FALSE) {
                    http_response_code(500);
                    die(createErrorResponse("<br>" . $stmt->error));
                }

                $result = $stmt->get_result();
                $auctions = array();

                while ($row = $result->fetch_assoc()) {
                    $auctions[] = $row;
                }

                echo json_encode(array(
                    "status" => "success",
                    "timestamp" => floor(microtime(true) * 1000),
                    "data" => $auctions));
            }else if($type = "Single") {
                $selectQuery = "SELECT * FROM auctions WHERE auction_id = ?;";
                $stmt = $this->conn->prepare($selectQuery);
                $stmt->bind_param("s", $auction);

                if ($stmt->execute() === FALSE) {
                    http_response_code(500);
                    die(createErrorResponse("<br>" . $stmt->error));
                }

                echo json_encode(array(
                    "status" => "success",
                    "timestamp" => floor(microtime(true) * 1000),
                    "data" => $stmt->get_result()->fetch_assoc()));
            }
        }else if(!empty($missingValues)){
            http_response_code(400);
            die(createErrorResponse("The following values are missing: " . implode(', ', $missingValues)));
        }else {
            http_response_code(400);
            die(createErrorResponse("The following keys are missing: " . implode(', ', $missingKeys)));
        }
    }

    function checkInsertVariables($name, $start, $end, $title, $price, $location, $bathrooms, $bedrooms, $parking, $amenities, $description, $image, $auctioneer) {
        if(!is_string($name)) {
            http_response_code(400);
            die(createErrorResponse("Name must be a string."));
        }

        if(!is_string($start) || !$this->is_date($start)) {
            http_response_code(400);
            die(createErrorResponse("Start date must be a string in format yyyy-mm-dd hh:mm:ss."));
        }
        
        if(!is_string($end) || !$this->is_date($end)) {
            http_response_code(400);
            die(createErrorResponse("End date must be a string in format yyyy-mm-dd hh:mm:ss."));
        }

        if(!is_string($title)) {
            http_response_code(400);
            die(createErrorResponse("Title must be a string."));
        }

        if(!is_int($price) && !is_float($price) && !is_double($price)) {
            http_response_code(400);
            die(createErrorResponse("Price must be a number."));
        }
        
        if(!is_string($location)) {
            http_response_code(400);
            die(createErrorResponse("Location must be a string."));
        }

        if(!is_int($bathrooms)) {
            http_response_code(400);
            die(createErrorResponse("Bathrooms must be an integer."));
        }

        if(!is_int($bedrooms)) {
            http_response_code(400);
            die(createErrorResponse("Bedrooms must be an integer."));
        }

        if(!is_int($parking)) {
            http_response_code(400);
            die(createErrorResponse("Parking spaces must be an integer."));
        }

        if(!is_string($amenities)) {
            http_response_code(400);
            die(createErrorResponse("Amenities must be a string."));
        }

        if(!is_string($description)) {
            http_response_code(400);
            die(createErrorResponse("Description must be a string."));
        }

        if($image != null && !is_string($image)) {
            http_response_code(400);
            die(createErrorResponse("Image must be a base64 string."));
        }

        if(!is_int($auctioneer)) {
            http_response_code(400);
            die(createErrorResponse("Auctioneer ID must be an integer."));
        }
    }

    function checkUpdateVariables($auction, $state, $highest, $history, $buyer_id) {
        if($auction == null) {
            http_response_code(400);
            die(createErrorResponse("Auction ID cannot be null."));
        }

        if(!is_string($auction)) {
            http_response_code(400);
            die(createErrorResponse("Auction ID must be a string."));
        }
        
        $selectQuery = "SELECT auction_id FROM auctions WHERE auction_id = ?;";
        $stmt = $this->conn->prepare($selectQuery);
        $stmt->bind_param("s", $auction);

        if ($stmt->execute() === FALSE) {
            http_response_code(500);
            die(createErrorResponse($selectQuery . "<br>" . $stmt->error));
        }

        if($stmt->get_result()->num_rows == 0) {
            http_response_code(409);
            die(createErrorResponse("This auction does not exist."));
        }

        if($state != null && (!is_string($state) || !($state == "Waiting" || $state == "Ongoing" || $state == "Done"))) {
            http_response_code(400);
            die(createErrorResponse("State must be 'Waiting', 'Ongoing' or 'Done'."));
        }

        if($highest != null && !is_int($highest) && !is_float($highest) && !is_double($highest)) {
            http_response_code(400);
            die(createErrorResponse("Highest bid must be a number."));
        }
        
        if($history != null && !is_string($history)) {
            http_response_code(400);
            die(createErrorResponse("Bid history must be a string."));
        }

        if($buyer_id != null && !is_int($buyer_id)) {
            http_response_code(400);
            die(createErrorResponse("Buyer ID must be an integer."));
        }

        if($buyer_id != null) {
            $selectQuery = "SELECT id FROM users WHERE id = ?;";
            $stmt = $this->conn->prepare($selectQuery);
            $stmt->bind_param("i", $buyer_id);

            if ($stmt->execute() === FALSE) {
                http_response_code(500);
                die(createErrorResponse($selectQuery . "<br>" . $stmt->error));
            }

            if($stmt->get_result()->num_rows == 0) {
                http_response_code(409);
                die(createErrorResponse("This buyer does not exist."));
            }
        }

        if($state != "Done" && $buyer_id != null) {
            http_response_code(400);
            die(createErrorResponse("Auction must be 'Done' for buyer ID to be updated."));
        }
    }

    function checkGetVariables($type, $auction) {
        if($type != "All" && $type != "Single") {
            http_response_code(400);
            die(createErrorResponse("Get type must be 'All' or 'Single'."));
        }

        if($type == "Single" && $auction == null) {
            http_response_code(400);
            die(createErrorResponse("Auction ID cannot be null if get type is 'Single'."));
        }

        if($auction != null && !is_string($auction)) {
            http_response_code(400);
            die(createErrorResponse("Auction ID must be a string."));
        }
        
        if($auction != null) {
            $selectQuery = "SELECT auction_id FROM auctions WHERE auction_id = ?;";
            $stmt = $this->conn->prepare($selectQuery);
            $stmt->bind_param("s", $auction);

            if ($stmt->execute() === FALSE) {
                http_response_code(500);
                die(createErrorResponse($selectQuery . "<br>" . $stmt->error));
            }

            if($stmt->get_result()->num_rows == 0) {
                http_response_code(409);
                die(createErrorResponse("This auction does not exist."));
            }
        }
    }

    function is_date($dateString) {
        $dateTimeObj = DateTime::createFromFormat('Y-m-d H:i:s', $dateString);
        return $dateTimeObj && $dateTimeObj->format('Y-m-d H:i:s') === $dateString;
    }
}

function checkApiKey($apiKey, $conn) {
    $checkQuery = "SELECT COUNT(*) AS count FROM users WHERE API_key = ?";
    $stmt = $conn->prepare($checkQuery);
    $stmt->bind_param("s", $apiKey);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();

    if ($row['count'] <= 0) {
        http_response_code(401);
        die(createErrorResponse("API key not found."));
    }
}

function getMissingValues($data) {
    $missingValues = array();

    foreach ($data as $key => $value) {
        if ($value === "") {
            $missingValues[] = $key;
        }
    }

    return $missingValues;
}

function createErrorResponse($errorMessage) {
    $errorResponse = array(
        "status" => "error",
        "timestamp" => floor(microtime(true) * 1000),
        "data" => $errorMessage
    );

    $errorResponseJson = json_encode($errorResponse);

    return $errorResponseJson;
}

header("Content-Type: application/json");
$json = json_decode(file_get_contents("php://input"), true);

if (array_key_exists("type", $json)) {
    if($json["type"] == "Register") {
        user::instance()->registerUser($json);
    }else if($json["type"] == "Login") {
        user::instance()->LoginUser($json["email"], $json["password"]);
    }else if($json["type"] == "SetPicture") {
        user::instance()->setPicture($json["apikey"], $json["picture"]);
    }else if($json["type"] == "SetTheme") {
        user::instance()->setTheme($json["apikey"], $json["theme"]);
    }else if($json["type"] == "SetFilters") {
        user::instance()->setFilters($json["apikey"], $json["search"], $json["sorttype"], $json["order"], $json["sort"], $json["bathrooms"], $json["bedrooms"], $json["price_min"], $json["price_max"]);
    }else if($json["type"] == "SetFavourites") {
        user::instance()->setFavourites($json["apikey"], $json["favourites"]);
    }else if($json["type"] == "GetUsername") {
        user::instance()->getUsername($json["apikey"], $json["id"]);
    }else if($json["type"] == "GetAllListings") {
        listings::instance()->getListings($json);
    }else if($json["type"] == "CreateAuction") {
        auction::instance()->createAuction($json);
    }else if($json["type"] == "UpdateAuction") {
        auction::instance()->updateAuction($json);
    }else if($json["type"] == "GetAuction") {
        auction::instance()->getAuction($json);
    }else {
        http_response_code(400);
        die(createErrorResponse("Invalid request type."));
    }
} else {
    http_response_code(400);
    die(createErrorResponse("Invalid POST data or no request type."));
}