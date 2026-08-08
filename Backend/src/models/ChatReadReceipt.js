import mongoose from "mongoose";

const schema = new mongoose.Schema({

    message_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"ChatMessage",
        required:true
    },

    user_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },

    read_at:{
        type:Date,
        default:Date.now
    }

});

export default mongoose.model(
    "ChatReadReceipt",
    schema
);