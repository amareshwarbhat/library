var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var bCrypt = require('bcrypt-nodejs');
var jwt = require('jsonwebtoken');

var mongoose = require('mongoose'); //Middleware

var AdminUser = require('./models/adminUser');//Admin User Model
var Book = require('./models/book');//Book model
var Transaction = require('./models/transactions');//Transaction model
var User = require('./models/user'); //Normal user model

app.use(bodyParser.json());

//We designed & developed Rest APIs in this project
//Use nodemon for auto server start for developement speedUP
//Use helmet package for security: Avoids unnecessary hits to server

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
})

//Security Token will Checks throughout the session
//Currently in this project we are using for only Admin Users
var isAuthenticatedAccessToken = function (req, res, next) {
    var token = req.headers['x-access-token'];
    // decode token
    if (token) {
        // verifies secret and checks exp
        jwt.verify(token, "amarTokenCode", function (err, decoded) {
            if (err) {
                return res.json({
                    success: false
                    , message: 'Failed to authenticate token.'
                });
            }
            else {
                // if everything is good, save to request for use in other routes
                req.user = decoded;
                console.log(decoded);
                next();
            }
        });
    }
    else {
        // if there is no token return an error
        return res.status(403).send({
            "statuscode": "203"
            , "msgkey": "api.access.token.failed"
            , "v": version
        });
    }
}

//Connect to mongoDb
mongoose.connect("mongodb://localhost:27017/test", function (err, db) {
    if (!err) {
        console.log("we are connected to mongo");
    }
})

//External function to retrieve the details of all user
function getAllUsers(req, res) {
    console.log(req.params);
    User.find({ userName: req.params['userName'] }).exec(function (err, result) {
        res.send(result);
    })
}

//This api will called to get the all user details & takes request in params
app.get('/users/:userName', getAllUsers)


//This api will called to create normal user
//Take userName, name, email, mobileNumber as request in body
app.post('/users', function (req, res) {
    var userName = req.body.userName;
    var name = req.body.name;
    var email = req.body.email;
    var mobileNumber = req.body.mobileNumber;

    console.log("req.body"); console.log(req.body);

    //Defining the User schema with details to save
    var user = new User(req.body);

    //Logic:
    //find the userName in DB
    //If err throw the error message
    //If user exists , send respo as user already exists
    //If result not found, then create user and return details
    User.findOne({ userName: userName }, function (err, result) {
        if (err) {
            res.status(500).send({
                message: err.message
            });
        }
        if (result) {
            res.json({
                "statuscode": 200
                , "msgkey": "username already exists"
            });
        }
        else {
            //Saving in MongoDB
            user.save(function (err, userStoredDetails) {
                if (err) {
                    res.send(err);
                }
                res.send(userStoredDetails);
            });
        }
    });
})


//This api will called to create Admin user
//Take userName, password, name, email, mobileNumber as request in body
app.post('/adminUsers', function (req, res) {
    var userName = req.body.userName;
    var password = req.body.password;
    var name = req.body.name;
    var email = req.body.email;
    var mobileNumber = req.body.mobileNumber;

    //Create Hash of password to Security perpose
    //Hashing is one way. You will not get back password using HashCode
    password = createHash(password);

    var props = { userName: userName, password: password, name: name, email: email, mobileNumber: mobileNumber };

    //Defining the User schema with details to save
    var adminUser = new AdminUser(props);

    //If userName already exists in adminUser record then do not create
    //else create adminUser record
    AdminUser.findOne({ userName: userName }, function (err, result) {
        if (err) {
            res.status(500).send({
                message: err.message
            });
        }
        if (result) {
            res.json({
                "statuscode": 200
                , "msgkey": "username already exists"
            });
        }
        else {
            //Saving in MongoDB
            adminUser.save(function (err, adminUserStoredDetails) {
                if (err) {
                    res.send(err);
                }
                res.send(adminUserStoredDetails);
            });
        }
    });
})
//External function to create hash of password
var createHash = function (password) {
    return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
}


//This api will called to login for Admin user
//Take userName, password as request in body
app.post('/adminUsers/login', function (req, res) {
    var userName = req.body.userName;
    var password = req.body.password;

    //If userName already exists in adminUser record then do not create
    //else create adminUser record
    AdminUser.findOne({ userName: userName }, function (err, result) {
        if (err) {
            res.status(500).send({
                message: err.message
            });
        }
        if (result) {
            var storedPassword = result.password;

            //Call compareHash function to match the stored password in DB
            var validPass = compareHash(password, storedPassword);
            if (validPass == true) {
                //Where amarTokenCode is the Secret Code and 24h is the token Validity
                var token = jwt.sign({ userName: userName }, "amarTokenCode", { expiresIn: '24h' });
                res.json({
                    "statuscode": 200,
                    "msgkey": "Login Success",
                    "token": token
                });
            }
            else {
                res.json({
                    "statuscode": 200
                    , "msgkey": "username/password is wrong"
                });
            }

            //or           
            /*bCrypt.compare(password, storedPassword, function (err, result) {
                if (result == true) {
                    res.json({
                        "statuscode": 200
                        , "msgkey": "Login Success"
                    });
                }
                else {
                    res.json({
                        "statuscode": 200
                        , "msgkey": "username/password is wrong"
                    });
                }
            });*/
            //
        }
        else {
            res.json({
                "statuscode": 200
                , "msgkey": "username not exists"
            });
        }
    });

})

//External function to compare hashed password
var compareHash = function (password, storedPassword) {
    return bCrypt.compareSync(password, storedPassword); // true/false
}


//This api will called to when admin will give books to normal user
//Take userName, bookISBN, status as request in body
//Status as borrow/return
//If null results then we api respo will say book available or not..!
//to-do 1: JWT Token for isAuthonticated for admin password to call this api everytime
app.post('/admin/transaction', isAuthenticatedAccessToken, function (req, res) {
    var userName = req.body.userName;
    var bookISBN = req.body.bookISBN;
    var status = req.body.status;

    //find the date and attach. Take unix machine
    //Logic:
    //1. if status is borrow
    //Find the book by ISBN
    //If book present check for user existance
    //If user found update his details in DB as he has received that book by ISBN
    //Then update the Book DB  'book_Status as book_not_available



    //1. if status is return
    //Find the book by ISBN
    //If book present check for user existance
    //If user found update his details in DB as he has received that book by ISBN
    //Then update the Book DB  'book_Status as book_available
    //If user not found then in such case somebody else gives the book without address.

    //to-do:
    //1:if somehow book is returned to library then find the book is borrowed by which person and update him also

    if (status == 'borrow') {
        console.log("borrow");
        Book.findOne({ bookISBN: bookISBN }, function (err, bookResult) {
            if (err) {
                res.status(500).send({
                    message: err.message
                });
            }
            if (bookResult) {
                console.log("Book is present");
                User.findOne({ userName: userName }, function (err, userResult) {
                    if (err) {
                        res.status(500).send({
                            message: err.message
                        });
                    }
                    if (userResult) {
                        console.log("user found");
                        userResult.myList = bookISBN;
                        userResult.save(function (err, todo) {
                            if (err) {
                                res.status(500).send(err)
                            }
                            bookResult.bookStatus = 'book_not_available';
                            bookResult.save(function (err, bookRemovedResult) {
                            });
                            res.send(todo);
                        });
                    }
                    else {
                        console.log("No user found");
                    }
                });
            }
            else {
                console.log("Book is not present");
            }
        });
    }

    if (status == 'return') {
        console.log("return");
        //find book by ISBN and update book available

        Book.findOne({ bookISBN: bookISBN }, function (err, bookResult) {
            if (err) {
                res.status(500).send({
                    message: err.message
                });
            }
            if (bookResult) {
                console.log("Book not available wait...processing");
                User.findOne({ userName: userName }, function (err, userResult) {
                    if (err) {
                        res.status(500).send({
                            message: err.message
                        });
                    }
                    if (userResult) {
                        console.log("user found");
                        userResult.myList = "";
                        userResult.save(function (err, todo) {
                            if (err) {
                                res.status(500).send(err)
                            }
                            bookResult.bookStatus = 'book_available';
                            bookResult.save(function (err, bookRemovedResult) {
                            });
                            res.send(todo);
                        });
                    }
                    else {
                        console.log("No user found");
                        //But somebody return the book ,update the book details thats it
                        bookResult.bookStatus = 'book_available';
                        bookResult.save(function (err, bookRemovedResult) {
                        });
                    }
                });
            }
            else {
                console.log("Book is not present");
            }
        });

    }
})



//This api will called to when admin will add/remove the books
//Take userName, bookISBN, author, status as request in body
//Status as add/remove
//If null results then api respo will say book available or not..!
//JWT Token for isAuthonticated for admin password to call this api everytime
app.post('/admin/updatebooks', isAuthenticatedAccessToken, function (req, res) {
    var bookName = req.body.bookName;
    var bookISBN = req.body.bookISBN;
    var author = req.body.author;
    var status = req.body.status;

    //find the date and attach. Take unix machine

    //Logic:
    //if status is add ,edit book_Status as book_available in the props & save the book details
    //if status is add ,edit book_Status as book_not_available in the props & save the book details

    if (status == 'add') {
        book_Status = 'book_available';
    }

    if (status == 'remove') {
        book_Status = 'book_not_available';
    }

    props = { bookName: bookName, bookISBN: bookISBN, author: author, bookStatus: book_Status }
    var book = new Book(props);
    //or 
    //var book = new Book(req.body);

    if (status == 'add') {
        book.save(function (err, bookAddedDetails) {
            if (err) {
                res.send(err);
            }
            if (bookAddedDetails) {
                res.send(bookAddedDetails);
            }
        });
    }

    if (status == 'remove') {
        /*  Book.remove({ bookISBN: bookISBN }, function (err, createdTodoObject) {
              if (err) {
                  res.send(err);
              }
              if (createdTodoObject) {
                  //add book_status as book_not_available to the result json array
                  res.send(createdTodoObject);
              }
          });
  */
        book.save(function (err, bookRemovedDetails) {
            if (err) {
                res.send(err);
            }
            if (bookRemovedDetails) {
                res.send(bookRemovedDetails);
            }
        });
    }
})

//server listning to port 5000
var server = app.listen(5000, function () {
    console.log('listning on port', server.address().port);
})