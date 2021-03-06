/*
Custom middleware
Runs before other route methods to expose data
*/

const { verifyToken } = require('./jwt');

const multer  = require('multer');
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const path = require('path');
const idConstructor = require('mongoose').Types.ObjectId;

module.exports = {
    // Middleware used for all routes
    // Attempt to login user
    // and call next() regardless of success
	login: async (req, res, next) => {
        const { token } = req.body;
console.log('Login')
        // No attempt to login
        if(!token) {
            console.log('Did not log in');
            return next();
        }

        try{
            console.log('about to verify')
            const payload = await verifyToken(token);
            console.log('Login Middleware');
            console.log(payload);

            // Logged in
            if(payload && payload.user) {
                console.log('Successfully logged in');
                req.user = payload.user;
            }else {
            // Invalid attempt to login
                console.log('Could not Log in');
                return res.status(500).send('Could not verify JWT');
            }
        }catch(err) {
            console.log(err);
        }
        
        // Always call next()
        console.log('Calling next from login middleware');
        return next();
    },
    /*
    Checks if user object exists on req
    If not, then not logged in, else is logged in
    */
    loggedIn: (req, res, next) => {
        if (req.user) {
            next();
        }else {
            console.log('Not logged in')
            res.status(401).send('Please login');
        }
    },

    /*
    Not a middleware method
    Instead, this method returns a middleware that exposes multiple image bytestreams from the api call
    */
    getMulterMultiple: (maxMegabytes, maxFiles, maxFields) => {
        const MB_SIZE = 1000000;
    
        const storage = multer.memoryStorage();
        const limits = {
            fileSize: maxMegabytes * MB_SIZE,
            files: maxFiles,
            fields: maxFields,
            fieldSize: 2 * 1024 * 1024
    
        }
        const multipleUpload = multer({
            storage,
            limits,
            fileFilter: function (req, file, cb) {
                var filetypes = /jpeg|jpg/;
                var mimetype = filetypes.test(file.mimetype);
                var extname = filetypes.test(path.extname(file.originalname).toLowerCase());
            
                if (mimetype && extname) {
                  return cb(null, true);
                }
                cb(null, false);
            }
        }).array('file');
    
        return multipleUpload;
    },
    /*
    Not a middleware method
    Instead, this method returns a middleware that exposes a single image bytestreams from the api call
    */
    getMulterSingle: (maxMegabytes, maxFields) => {
        const MB_SIZE = 1000000;
    
        const storage = multer.memoryStorage();
        const limits = {
            fileSize: maxMegabytes * MB_SIZE,
            fields: maxFields,
            fieldSize: 2 * 1024 * 1024

        }
        const singleUpload = multer({
                storage,
                limits,
                fileFilter: function (req, file, cb) {
                    var filetypes = /jpeg|jpg/;
                    var mimetype = filetypes.test(file.mimetype);
                    var extname = filetypes.test(path.extname(file.originalname).toLowerCase());
                
                    if (mimetype && extname) {
                      return cb(null, true);
                    }
                    cb(null, false);
                }
            }).single('file');
    
        return singleUpload;
    },
    /*
    This middleware uploads images to AWS
    and exposes an array of AWS imageUrls and ids on the req object
    */
    uploadToAws: async(req, res, next) => {
        const bucketName = 'infridge-backend-chris';
        const userId = req.user._id;

        console.log('In AWS')
        console.log(req.body);
        // console.log(req.file)

        // Get files
        // File was added by multer middleware
        // Check 'file' or 'files' based on multer option
        let files;
        if(req.file) {
            files = [{
                buffer: req.file.buffer,
                name: req.file.originalname
            }];
        }
        else if(req.files){
            files = req.files.map(file => ({
                buffer: file.buffer,
                name: file.originalname
            }));
        }else{
            console.log('No image file found');
            return next();
        }

        // Create id for file
        // Upload and save url
        try {
            let awsUrls = [];
            let ids = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const id = idConstructor();

                const uploadParams = {
                    Bucket: bucketName,
                    Key: `users/${userId}/${id}`,
                    Body: file.buffer,
                    ACL: 'public-read'
                };

                await s3.upload(uploadParams).promise();

                const url = `https://${bucketName}.s3.amazonaws.com/${uploadParams.Key}`;
                awsUrls.push(url);
                ids.push(id);
            }
            console.log('uploaded');

            // ATTRIBUTES ADDED TO REQ OBJECT
            req.awsUrls = awsUrls;
            req.ids = ids;

            next();
        }catch(err) {
            console.log(err)
        }
    }
}
