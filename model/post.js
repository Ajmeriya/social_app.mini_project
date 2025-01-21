// post.js
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    content: {
        type: String,
        required: true
    },
    likes: [{
        type: String  // Store email addresses for likes
    }],
    date: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

postSchema.virtual('comments', {
    ref: 'comment',
    localField: '_id',
    foreignField: 'post'
});

module.exports = mongoose.model("post", postSchema);