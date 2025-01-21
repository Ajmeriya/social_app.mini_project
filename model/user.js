// user.js
const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/test1');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    age: {
        type: Number
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    posts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "post"
    }],

    followers: {
        type: [String],
        default: []
    },
    following: {
        type: [String],
        default: []
    }

}, { timestamps: true });

module.exports = mongoose.model("user", userSchema);