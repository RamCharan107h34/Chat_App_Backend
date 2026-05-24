import exp from "express";
import multer from "multer";
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";
import { verifyToken } from "../middlewares/verifyToken.js";

export const fileTransferApp = exp.Router();

//ALLOWED FILE TYPES
const allowedMimeTypes = [
  // images
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  // pdf
  "application/pdf",
  // videos
  "video/mp4",
  "video/webm",
  // audio
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  // docs
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // text
  "text/plain",
  // zip
  "application/zip",
  "application/x-zip-compressed",
];

//FILE FILTER
const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Unsupported file type"),
      false
    );
  }
};

//MULTER MEMORY STORAGE
const storage = multer.memoryStorage();

//MULTER INSTANCE
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter,
});

//SINGLE FILE UPLOAD
fileTransferApp.post("/",verifyToken,upload.single("file"),async (req, res) => {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }
      //CLOUDINARY STREAM UPLOAD
      const streamUpload = () => {
        return new Promise((resolve, reject) => {
          const stream =
            cloudinary.uploader.upload_stream({
  folder: "slack-clone-files",
  resource_type: "auto", // ✅ FIX HERE
  use_filename: true,
  unique_filename: false,
  filename_override: file.originalname,
},
              (error, result) => {
                if (error) {
                  reject(error);
                } else {
                  resolve(result);
                }
              }
            );
          streamifier
            .createReadStream(file.buffer)
            .pipe(stream);
        });
      };

      const result = await streamUpload();
      res.status(200).json({
        success: true,
        message: "File uploaded successfully",
        file: {
          url: result.secure_url,
          public_id: result.public_id,
          fileName: file.originalname,
          type: file.mimetype,
          size: file.size,
        },
      });
  }
);


//MULTIPLE FILE UPLOAD
fileTransferApp.post("/multiple",verifyToken,upload.array("files", 5),async (req, res) => {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files uploaded",
        });
      }
      const uploadedFiles = [];
      for (const file of files) {
        const streamUpload = () => {
          return new Promise((resolve, reject) => {
            const stream =
              cloudinary.uploader.upload_stream({
  folder: "slack-clone-files",
  resource_type: "auto", // ✅ SAME FIX
  use_filename: true,
  unique_filename: false,
  filename_override: file.originalname,
},
                (error, result) => {
                  if (error) {
                    reject(error);
                  } else {
                    resolve(result);
                  }
                }
              );
            streamifier
              .createReadStream(file.buffer)
              .pipe(stream);
          });
        };
        const result = await streamUpload();
        uploadedFiles.push({
          url: result.secure_url,
          public_id: result.public_id,
          fileName: file.originalname,
          type: file.mimetype,
          size: file.size,
        });
      }
      res.status(200).json({
        success: true,
        message: "Files uploaded successfully",
        files: uploadedFiles,
      });
  }
);


//DELETE FILE
fileTransferApp.delete("/:public_id",verifyToken,async (req, res) => {
      const { public_id } = req.params;
      await cloudinary.uploader.destroy(
        public_id,
        {
          resource_type: "auto",
        }
      );
      res.status(200).json({
        success: true,
        message: "File deleted successfully",
      });
  }
);