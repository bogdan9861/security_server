const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: "dhnhvvkx7",
  api_key: "547668788456733",
  api_secret: "pM6SyKdCmtFWFUOp3Bd-fsxxigk",
});

const uploadFile = async (filePath, publicId, folder = "tickets") => {
  const result = await cloudinary.uploader.upload(filePath, {
    public_id: publicId,
    folder,
    resource_type: "auto",
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format,
  };
};

module.exports = uploadFile;
