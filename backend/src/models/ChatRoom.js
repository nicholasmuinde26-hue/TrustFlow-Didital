import mongoose from "mongoose";

const chatRoomSchema = new mongoose.Schema(
{
    workspace_id:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        index:true
    },

    workspace_type:{
        type:String,
        enum:[
            "Chama",
            "ContributionGroup"
        ],
        required:true
    },

    name:{
        type:String,
        required:true
    },

    last_message:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"ChatMessage",
        default:null
    },

    last_activity_at:{
        type:Date,
        default:Date.now
    }
},
{
    timestamps:true
});

export default mongoose.model(
    "ChatRoom",
    chatRoomSchema
);