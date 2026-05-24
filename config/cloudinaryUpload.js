import cloudinary from "./cloudinary.js";

export const uploadToCloudinary = (buffer, originalName) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "blog_users_b2",

        resource_type: "auto", // 🔥 important

        use_filename: true,
        unique_filename: false,

        // optional but useful
        filename_override: originalName,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};