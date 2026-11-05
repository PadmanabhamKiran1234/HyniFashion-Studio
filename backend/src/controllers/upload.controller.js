import { uploadImage } from '../services/cloudinary.service.js';

export const testImageUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select an image.',
      });
    }

    const uploadedImage = await uploadImage(req.file.buffer);

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully.',
      data: uploadedImage,
    });
  } catch (error) {
    next(error);
  }
};