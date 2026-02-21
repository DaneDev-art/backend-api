// ===============================
// routes/messageRoutes.js
// Version PRO compatible User & Seller avec Cloudinary
// CORRIGÉ pour supporter Conversation + CustomOrder
// ===============================

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/user.model");
const Seller = require("../models/Seller");
const Product = require("../models/Product");

const cloudinary = require("cloudinary").v2;


// ============================================
// Cloudinary config
// ============================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


// ============================================
// SOCKET IO
// ============================================

let io;

function initSocket(socketInstance) {
  io = socketInstance;
}


// ============================================
// MULTER
// ============================================

const storage = multer.diskStorage({

  destination: function (req, file, cb) {

    const dir = "./uploads/messages";

    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true });

    cb(null, dir);

  },

  filename: function (req, file, cb) {

    const unique =
      Date.now() + "_" +
      Math.round(Math.random() * 1e9);

    cb(null, unique + path.extname(file.originalname));

  }

});

const upload = multer({ storage });


// ============================================
// ENVOYER MESSAGE TEXTE
// ============================================

router.post("/", async (req, res) => {

  try {

    const {
      conversationId,
      senderId,
      receiverId,
      message,
      productId
    } = req.body;


    // Trouver ou créer conversation si non fournie
    let conversation;

    if (conversationId) {

      conversation =
        await Conversation.findById(conversationId);

    } else {

      conversation =
        await Conversation.findOne({
          participants: {
            $all: [senderId, receiverId],
            $size: 2
          }
        });

      if (!conversation) {

        conversation =
          await Conversation.create({

            participants: [senderId, receiverId],

            product: productId
              ? { productId }
              : {}

          });

      }

    }


    const newMessage =
      await Message.create({

        conversation: conversation._id,

        sender: senderId,

        text: message || "",

        type: "TEXT",

        readBy: [senderId]

      });


    // update conversation

    const otherUser =
      conversation.participants.find(
        id => id.toString() !== senderId
      );

    await Conversation.findByIdAndUpdate(
      conversation._id,
      {
        lastMessage: message,
        lastDate: new Date(),
        $inc: {
          [`unreadCounts.${otherUser}`]: 1
        }
      }
    );


    // socket

    if (io) {

      io.to(conversation._id.toString())
        .emit("message:new", newMessage);

    }


    res.status(201).json(newMessage);

  }

  catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

});


// ============================================
// ENVOYER MEDIA
// ============================================

router.post(
  "/media",
  upload.single("file"),
  async (req, res) => {

    try {

      const {
        conversationId,
        senderId,
        receiverId,
        type
      } = req.body;


      if (!req.file)
        return res.status(400).json({
          error: "File manquante"
        });


      const resourceType =
        type === "audio"
          ? "raw"
          : "image";


      const uploadResult =
        await cloudinary.uploader.upload(
          req.file.path,
          {
            folder:
              `messages/${senderId}`,
            resource_type:
              resourceType
          }
        );


      fs.unlinkSync(req.file.path);


      const message =
        await Message.create({

          conversation: conversationId,

          sender: senderId,

          type:
            type === "audio"
              ? "AUDIO"
              : "IMAGE",

          mediaUrl:
            uploadResult.secure_url,

          readBy: [senderId]

        });


      if (io) {

        io.to(conversationId)
          .emit("message:new", message);

      }


      res.status(201).json(message);

    }

    catch (err) {

      console.error(err);

      res.status(500).json({
        error: err.message
      });

    }

  }
);


// ============================================
// UPDATE MESSAGE
// ============================================

router.put(
  "/update/:messageId",
  async (req, res) => {

    try {

      const {
        messageId
      } = req.params;

      const {
        senderId,
        newContent
      } = req.body;


      const msg =
        await Message.findById(messageId);

      if (!msg)
        return res.status(404).json({
          error: "Message non trouvé"
        });


      if (
        msg.sender.toString()
        !== senderId
      )
        return res.status(403).json({
          error: "Non autorisé"
        });


      msg.text = newContent;

      await msg.save();


      res.json(msg);

    }

    catch (err) {

      res.status(500).json({
        error: err.message
      });

    }

  }
);


// ============================================
// DELETE MESSAGE
// ============================================

router.delete(
  "/delete/:messageId",
  async (req, res) => {

    try {

      const msg =
        await Message.findById(
          req.params.messageId
        );

      if (!msg)
        return res.status(404).json({
          error: "Not found"
        });


      msg.text =
        "[message supprimé]";

      await msg.save();


      res.json({
        success: true
      });

    }

    catch (err) {

      res.status(500).json({
        error: err.message
      });

    }

  }
);


// ============================================
// GET CONVERSATIONS USER
// ============================================

router.get(
  "/conversations/:userId",
  async (req, res) => {

    try {

      const conversations =
        await Conversation.find({

          participants:
            req.params.userId

        })
        .sort({
          lastDate: -1
        })
        .lean();


      const result =
        await Promise.all(

          conversations.map(
            async conv => {

              const otherId =
                conv.participants
                  .find(
                    id =>
                      id.toString()
                      !== req.params.userId
                  );


              const user =
                await User.findById(otherId)
                ||
                await Seller.findById(otherId);


              return {

                ...conv,

                unread:
                  conv.unreadCounts?.[
                    req.params.userId
                  ] || 0,

                otherUser: {

                  _id:
                    user?._id,

                  name:
                    user?.name ||
                    user?.fullName ||
                    user?.shopName,

                  avatar:
                    user?.avatar || ""

                }

              };

            }

          )

        );


      res.json(result);

    }

    catch (err) {

      res.status(500).json({
        error: err.message
      });

    }

  }
);


// ============================================
// GET MESSAGES CONVERSATION
// ============================================

router.get(
  "/conversation/:conversationId",
  async (req, res) => {

    try {

      const messages =
        await Message.find({

          conversation:
            req.params.conversationId

        })
        .populate("sender")
        .populate("customOrder")
        .sort({
          createdAt: 1
        });


      res.json(messages);

    }

    catch (err) {

      res.status(500).json({
        error: err.message
      });

    }

  }
);


// ============================================
// MARK AS READ
// ============================================

router.put(
  "/markAsRead",
  async (req, res) => {

    try {

      const {
        conversationId,
        userId
      } = req.body;


      await Message.updateMany(
        {
          conversation:
            conversationId,
          readBy:
            { $ne: userId }
        },
        {
          $addToSet: {
            readBy: userId
          }
        }
      );


      await Conversation.findByIdAndUpdate(
        conversationId,
        {
          [`unreadCounts.${userId}`]:
            0
        }
      );


      res.json({
        success: true
      });

    }

    catch (err) {

      res.status(500).json({
        error: err.message
      });

    }

  }
);


// ============================================
// EXPORT
// ============================================

module.exports = {
  router,
  initSocket
};