// Module to that handles reading and writing user food items
// via the User and UserFood models
// Can getAll, create, delete, and deleteMultiple

const util = require('../utility/responses');
const User = require('../models/User');
const { Post } = require('../models/Post');
const Transaction = require('../models/Transaction');
const Comment = require('../models/Comment');

const idConstructor = require('mongoose').Types.ObjectId;

module.exports = {
        /*
            Get a User's post

            params: postId
            return: Post object
        */
        getUserPost: (req, res) => {
            const { postId } = req.params;
        
            util.respondWithDataById(res, Post, postId);
        },

        /*
            Get all of a User's posts

            params: userId
            return: Array of Post objects
        */
        getAllUserPosts: (req, res) => {
            const userId = req.params.userId;
console.log('Get All User Posts');

            util.populateAndRespond(res, User, userId, 'posts');
        },

        /*
            Test method to get all Posts from the database

            params: node
            return: Array of all Post objects
        */
        getAllPosts: async (req, res) => {
            try {
                console.log('getAllPosts')
                const allPosts = await Post.find({ 'kind': 'Transaction' }).sort({createdAt:-1}).populate('comments');

                console.log('success');

		        console.log(allPosts);

                res.status(201).send({
                    data: allPosts
                });
            }catch(err) {
                console.log('error')

                res.status(404).send({
                    response: err.name,
                    message: err.message
                });
            }
        },

        /*
            Delete a User's Post

            params: postId
            return: Sucess or error message
        */
       deletePost: async(req, res) => {
            console.log('in')
            try{
                const { postId } = req.body;

                const userId = await Post.findById(postId).select('author');
                console.log(userId);

                const password = await User.findById(userId).select('password');
                console.log(password);

                // Decrypt password
                // if(inputPassword === password) {
                    const remove = await Post.findByIdAndRemove(postId);
                    res.status(201).send(remove);
                // }else throw new Error('Invalid credentials');

            }catch(err) {
                res.status(409).send(err);
            }
        },

        /*
            Like a User's Post

            params: userId
            return: Sucess or error message
        */
        likePost: async(req, res) => {
            const userId = req.user._id;
            const { postId } = req.body;

            try {
                const response = await Post.likePost(userId, postId);

                res.status(200).send(response);

            }catch(err) {
                res.status(400).send(err);
            }
        },

        /*
            Create a new Transaction for a User

            params required: userId, username, transactionId, longitude, latitude, tradeType
            params optional: transactionBody, imageUrl
            return: Sucess or error message
        */
       createTransaction: async(req, res) => {
            try {
console.log(req.body);
                // Grab userId, provided by login middleware
                const userId = req.user._id;
                const username = req.user.name;
                // Grab Transaction and image data from req
                // Added by multer and aws middleware
                const transactionId = req.ids ? req.ids[0] : idConstructor();
                const imageUrl = req.awsUrls ? req.awsUrls[0] : '';

                const { body, longitude, latitude, tradeType } = req.body;

                console.log('Creating a Transaction')
                console.log(body);

                console.log(1)
                if(!imageUrl && !body || !longitude && !latitude) return res.status(400).send("Please include at least an Image OR Desciption AND please set your location");
            console.log(2)
                const transaction = new Transaction({
                    _id: transactionId,
                    authorId: userId,
                    authorName: username,
                    body,
                    location:{longitude,latitude},
                    tradeType,
                    imageUrl
                });

                // Save Transaction
                const save = await transaction.save();
                
                // Save to User
                const query = { _id: userId };
                const update = {
                    $push: {
                        posts: {
                            $each: [ transaction._id ],
                            $position: 0
                        }
                    }
                }
                await User.updateOne(    
                    query,
                    update
                );

                // Success!
                res.status(201).send({
                    data: save,
                });
            }catch(err) {
		    console.log(err);
                res.status(409).send(err);
            }
        },
        /*
            Create a new Status Post for a User

            params required: userId, username, postId
            params optional: postBody, imageUrl
            return: Sucess or error message
        */
        createStatusPost: async(req, res) => {
            try {
                // Grab userId, provided by login middleware
                const userId = req.user._id;
                const username = req.user.name;
                // Grab Transaction and image data from req
                // Added by multer and aws middleware
                const postId = req.ids ? req.ids[0] : idConstructor();
                const imageUrl = req.awsUrls ? req.awsUrls[0] : '';

                const { body } = req.body;

                console.log('Creating a Status Post');
                console.log(req.body);
                console.log('----');
                console.log(body);

                if(!imageUrl && !body) return res.status(400).send("Please include at least an Image OR Desciption");
            
                const post = new Post({
                    _id: postId,
                    authorId: userId,
                    authorName: username,
                    body,
                    imageUrl
                });

                // Save Post
                const save = await post.save();

                console.log('----');
                console.log(save);
                
                // Save to User
                const query = { _id: userId };
                const update = {
                    $push: {
                        posts: {
                            $each: [ post._id ],
                            $position: 0
                        }
                    }
                }
                await User.updateOne(    
                    query,
                    update
                );

                // Success!
                res.status(201).send({
                    data: save,
                });
            }catch(err) {
		    console.log(err);
                res.status(409).send(err);
            }
        },

        /*
            'Complete' a Transaction by adding purchaser's userId to the transaction

            params required: trasactionId, buyerId
            return: Success or error message
        */
        completeTransaction: async(req, res) => {
            try{
                const { transactionId, buyer } = req.body;

                const transactionQuery = { _id: transactionId };
                const transactionUpdate = { buyer: buyer };
                const userQuery = { _id: buyer };
                const userUpdate = { $push: { posts: transactionId } };

                const transactionData = await Transaction.updateOne(
                    transactionQuery,
                    transactionUpdate
                );

                const userData = await User.updateOne(
                    userQuery,
                    userUpdate
                );

                res.status(201).send(
                    {
                        data: {
                            ...transactionData,
                            ...userData
                        }
                    }
                )
            }catch(err) {
                res.status(409).send(err);
            }
        },

        /*
            Like a Transaction by adding purchaser's userId to the transaction's likeList

            params required: userId, username, postId, postBody
            return: Success or error message
        */
        createComment: async(req, res) => {
            try{
                const userId = req.user._id;
                const username = req.user.name;
                console.log(req.user)

                const { postId, body } = req.body;
                const comment = new Comment({
                    postId,
                    authorId: userId,
                    authorName: username,
                    body
                });

                // Save comment
                const save = await comment.save();

                // Save to Post
                const query = { _id: postId };
                const update = { $push: { comments: comment._id } };

                await Post.updateOne(
                    query,
                    update
                );

                res.status(201).send({
                    data: save
                });
                
            }catch(err){
                console.log(err);
                res.status(409).send(err);
            }
        }
}
