const util = require('../utility/responses');
const User = require('../models/User');
const Request = require('request');

const jwtSigner = require('../utility/jwt');
var passport = require('passport');

//credentials to create the URL for oauth that connects to Microsoft Graph Project
const credentials = {
  client: {
    id: process.env.OAUTH_APP_ID,
    secret: process.env.OAUTH_APP_PASSWORD,
  },
  auth: {
    tokenHost: 'https://login.microsoftonline.com',
    authorizePath: 'common/oauth2/v2.0/authorize',
    tokenPath: 'common/oauth2/v2.0/token'
  }
};

const oauth2 = require('simple-oauth2').create(credentials);


// const { authenticateUser } = require('../MicrosoftGraph/microsoftGraph');


module.exports = {
        //loginTest is an async function that creates a JWT and a session for the user that is logged in. This allows the user to access the rest of the app and sign their account to their actions.
        loginTest: async(req, res) => {
            const { userId } = req.body;
    
            try {
                // Find User, create JWT from user id
                let userDoc = await User.findById(userId).select('_id');
                jwtSigner.createAndSendToken(
                    {
                        user: {
                            _id: userDoc._id
                        }
                    }, res);

            }catch(err) {
                console.log(err);
                res.status(502).send(err);
            }
        },

        //authenticateUser is an async function that sends the URL to view on the frontend's Webview component. This URL is the Microsoft sign in page for our InFridge project 
        authenticateUser: async (req, res) => {
            console.log(oauth2);
          
            const authURL = oauth2.authorizationCode.authorizeURL({
                redirect_uri: process.env.OAUTH_REDIRECT_URI,
                scope: process.env.OAUTH_SCOPES
            });
            
            res.send({
              authURL
            });
            console.log(`Generated auth url: ${authURL}`);
        },

        //verifyToken is an async function that confirms that the authenication token can generate a valid access token from the Microsoft account that was signed in (with the OKTA account)
        verifyToken: async (req,res) => {

            let authToken = req.body.code;
            console.log(authToken);

            // Verify auth token here
            const tokenConfig = {
                code: authToken,
                redirect_uri: 'https://school.corg.network:3002/graph-response',
                scope: process.env.OAUTH_SCOPES
            };

            try {
                const result = await oauth2.authorizationCode.getToken(tokenConfig)
                const accessToken = oauth2.accessToken.create(result);
                console.log("accessToken:");
                console.log(accessToken);
                res.send(200); 
            } catch (error) {
                console.log('Access Token Error', error.message);
                res.send(400);
            }
        },

        //verifyUsername is an async function that makes sure the username is not taken when creating a new username. It checks MongoDB to see if the username already exists.
        verifyUsername: async (req, res) => {
           try {
            const { username } = req.body;
            console.log("USERNAME:");
            console.log(username);
            const user = await User.find({ username });
            console.log("USERRRRRRRRRR:");
            console.log(user);
            if(user.length) return res.status(403).send('Username already exists');
            else res.status(200).send('Username is available');

           } catch (err){
                console.log(err);
           }
        },

        //loginUser is an async function that matches the typed in credentials to see if it is stored in MongoDB
        loginUser: async (req, res) => {
            try {
                let  { username, password } = req.body;

                let user = await User.findOne({name:username,password});
                console.log(user);

                if(user){
                    const data = {
                        userId: user._id,
			username: user.name,
                        token: await jwtSigner.createToken(
                            {
                                user: {
                                    _id: user._id,
                                    name: user.name
                                }
                            })
                    };

                    console.log(data);
                    res.status(201).send(data);
                }else{
                    res.status(400).send({
                        error:"Invalid credentials"
                    });
                }
            } catch(err){
                console.log(err);
                res.status(400).send({error:"Invalid credentials"});
            }

        },

        //signout function signs out the user from the current session. They are not able to access the app unless they log in again.
        signout: (req, res) => {
            req.session.destroy(function(err) {
              req.logout();
              res.redirect('/');
            });
        }

}
