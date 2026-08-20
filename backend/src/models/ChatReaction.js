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

    reaction:{
        type:String,
        required:true
    }

},{
    timestamps:true
});

export default mongoose.model(
    "ChatReaction",
    schema
);