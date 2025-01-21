//app.ejs

const express=require('express');
const app=express();
const path=require('path');
const cookiesParser=require('cookie-parser');
const userModel = require('./model/user');
const postModel = require('./model/post');
const commentModel = require('./model/comment');
const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');

app.set("view engine","ejs");
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,'public')));
app.use(cookiesParser());

app.get('/', (req,res)=>{
    res.render('index');
})

app.get('/register', (req, res) => {
    res.render('index');
});

app.post('/register',async (req,res)=>{
    let {email, password , username,name, age}=req.body;

    let user = await userModel.findOne({email});
    if(user) return res.status(500).send("user already register");

    bcrypt.genSalt(10,(err,salt)=>{
        bcrypt.hash(password,salt,async (err,hash)=>{

            let createdUser = await userModel.create({
                username: username,
                name: name,
                email: email,
                password: hash,
                age: age
            })


            let token=jwt.sign({email:email},"shhhhhh");
            res.cookie("token",token);
            
            res.send("registered");
        })    
    })
})
// GET route for login page
app.get('/login', async (req, res) => {
    res.render('login');
});

// POST route for login
app.post('/login', async (req, res) => {
    let {email, password} = req.body;

    let user = await userModel.findOne({email});
    if(!user) return res.status(500).send("please sign up first");

    bcrypt.compare(password, user.password, function(err, result) {
        if(result) {
            let token = jwt.sign({email: email}, "shhhhhh");
            res.cookie("token", token);
            res.redirect('/profile');
        } else {
            res.redirect('/login');
        }
    });
});

app.get('/profile', isLoggedIn, async (req, res) => {
    try {
        let currentUser = await userModel.findOne({ email: req.user.email }).populate({
            path: 'posts',
            populate: {
                path: 'user',
                select: 'username name email'
            }
        });

        let allPosts = await postModel.find()
            .populate('user', 'username name email')
            .sort({ date: -1 });

        // Fetch and populate comments for all posts
        const comments = await commentModel.find({
            post: { $in: allPosts.map(post => post._id) }
        }).populate('user', 'username name email').sort({ date: 1 });

        // Group comments by post ID
        const commentsByPost = {};
        comments.forEach(comment => {
            if (!commentsByPost[comment.post]) {
                commentsByPost[comment.post] = [];
            }
            commentsByPost[comment.post] = commentsByPost[comment.post] || [];
            commentsByPost[comment.post].push(comment);
        });

        let allUsers = await userModel.find({ 
            email: { $ne: req.user.email } 
        }).select('username followers following');

        res.render('profile', {
            user: currentUser,
            allPosts: allPosts,
            allUsers: allUsers,
            commentsByPost: commentsByPost
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error loading profile");
    }
});


app.post('/profile', isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        const post = await postModel.create({
            user: user._id,
            content: req.body.content
        });

        user.posts.push(post._id);
        await user.save();

        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error creating post");
    }
});



app.get('/follow/:username', isLoggedIn, async (req, res) => {
    try {
        // Get the user to follow
        let userToFollow = await userModel.findOne({ username: req.params.username });
        // Get the current user
        let currentUser = await userModel.findOne({ email: req.user.email });

        if (!userToFollow || !currentUser) {
            return res.status(404).send("User not found");
        }

        // Check if already following
        const isFollowing = currentUser.following.includes(userToFollow.username);
        
        if (!isFollowing) {
            // Add to following/followers
            currentUser.following.push(userToFollow.username);
            userToFollow.followers.push(currentUser.username);
        } else {
            // Remove from following/followers
            currentUser.following = currentUser.following.filter(username => username !== userToFollow.username);
            userToFollow.followers = userToFollow.followers.filter(username => username !== currentUser.username);
        }

        await currentUser.save();
        await userToFollow.save();
        
        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error processing follow request");
    }
});

app.get('/like/:id', isLoggedIn, async (req,res) => {
    try {
        let post = await postModel.findOne({_id: req.params.id});
        
        if (!post) {
            return res.status(404).send("Post not found");
        }

        // Change this to use the actual user ID from req.user
        const userLiked = post.likes.includes(req.user.email);
        console.log(userLiked);
        
        
        if (!userLiked) {
            post.likes.push(req.user.email);
        } else {
            post.likes = post.likes.filter(like => like !== req.user.email);
        }

        await post.save();
        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error processing like");
    }
});


app.get('/edit/:id', isLoggedIn, async (req, res) => {
    try {
        const post = await postModel.findOne({ _id: req.params.id });

        if (!post) {
            return res.status(404).send("Post not found");
        }

        res.render('edit', { post });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error loading edit page");
    }
});

app.post('/edit/:id', isLoggedIn, async (req, res) => 
{
    try {
        const post = await postModel.findOne({ _id: req.params.id });

        if (!post) {
            return res.status(404).send("Post not found");
        }

        post.content = req.body.content;
        await post.save();

        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating post");
    }
});

app.post('/comment/:postId', isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const post = await postModel.findById(req.params.postId);
        
        if (!post) {
            return res.status(404).send("Post not found");
        }

        const comment = await commentModel.create({
            user: user._id,
            post: post._id,
            content: req.body.content
        });

        await comment.save();
        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error creating comment");
    }
});

// Route to edit a comment
app.post('/comment/edit/:commentId', isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const comment = await commentModel.findById(req.params.commentId);
        
        if (!comment) {
            return res.status(404).send("Comment not found");
        }

        // Check if the user owns the comment
        if (comment.user.toString() !== user._id.toString()) {
            return res.status(403).send("Unauthorized");
        }

        // Update the comment content
        comment.content = req.body.content;
        await comment.save();
        
        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating comment");
    }
});


// Delete post route
app.post('/post/delete/:postId', isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const post = await postModel.findById(req.params.postId);
        
        if (!post || post.user.toString() !== user._id.toString()) {
            return res.status(403).send("Unauthorized");
        }

        // Delete all comments associated with this post
        await commentModel.deleteMany({ post: post._id });

        // Remove post from user's posts array
        user.posts = user.posts.filter(p => p.toString() !== post._id.toString());
        await user.save();

        // Delete the post
        await post.deleteOne();

        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting post");
    }
});

// Delete comment route
app.post('/comment/delete/:commentId', isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const comment = await commentModel.findById(req.params.commentId);
        
        if (!comment || comment.user.toString() !== user._id.toString()) {
            return res.status(403).send("Unauthorized");
        }

        await comment.deleteOne();
        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting comment");
    }
});

app.get('/logout',(req,res)=>{
    res.cookie("token", "");
    res.redirect("/login");
})


function isLoggedIn(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        res.redirect('/login');
    }

    try {
        const data = jwt.verify(token, "shhhhhh");
        req.user = data;
        next();
    } catch (err) {
        res.redirect('/profile');
    }
}



app.listen(3000);
