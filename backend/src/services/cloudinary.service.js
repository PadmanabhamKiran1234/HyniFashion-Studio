import cloudinary from '../config/cloudinary.js';

export const uploadImage = (fileBuffer, folder = 'hyni/products') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};

export const deleteImage = async (publicId) => {
  if (!publicId) return null;

  return cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
  });
};