const Product = require("../models/Product");
const Brand = require('../models/Brand');
const User = require('../models/User');
const createProduct = async (req, res) => {
  try {
    const {
      product_id,
      name,
      brand,
      category,
      tags,
      rating,
      cost_price,
      retail_price,
      stock_quantity,
      description
    } = req.body;

    let base64Image = null;
    if (req.file && req.file.buffer) {
      base64Image = req.file.buffer.toString("base64");
    }

    const product = new Product({
      product_id,
      name,
      brand,
      category,
      tags: tags ? tags.split(",").map(tag => tag.trim()) : [],
      rating: parseFloat(rating) || 0,
      cost_price,
      retail_price,
      stock_quantity,
      description,
      image_url: "data:image/png;base64,"+base64Image
    });

    await product.save();
    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error("Error in createProduct:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};



// Get All Products
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({});
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products", error });
  }
};

// Get Single Product by ID
const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ product_id: req.params.id });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch product", error });
  }
};

const updateProduct = async (req, res) => {
  try {
    let updateData = { ...req.body };

    // Handle image file if uploaded
    if (req.file && req.file.buffer) {
      const base64Image = req.file.buffer.toString("base64");
      updateData.image_url = `data:image/png;base64,${base64Image}`;
    }

    // Ensure tags are always stored as array
    if (typeof updateData.tags === "string") {
      updateData.tags = updateData.tags
        .split(",")
        .map(tag => tag.trim())
        .filter(tag => tag);
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { product_id: req.params.id },
      { $set: updateData },  // make sure only updated fields are modified
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Product updated", product: updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Failed to update product", error });
  }
};


const updateSingleProductQty = async (req, res) => {
  try {
    console.log(req.body)
    const updatedProduct = await Product.findOneAndUpdate(
      { product_id: req.body.product_id },
      req.body,
      { new: true }
    );

    console.log(updatedProduct)

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }
 
    res.status(200).json({ message: "Product updated", product: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: "Failed to update product", error });
  }
};

// Delete Product
const deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findOneAndDelete({ product_id: req.params.id });

    if (!deleted) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete product", error });
  }
};



//////////////////////////////////Brand managemnet rouets /////////////////////////////////////

// Add brand
const addBrand = async (req, res) => {
  try {
    const { brandName, popularBrand } = req.body;
    console.log('Request body:', req.body); // Debug log
    if (!brandName) {
      return res.status(400).json({ message: 'Brand name is required' });
    }
    const newBrand = new Brand({
      brandName,
      popularBrand: popularBrand || false,
    });
    await newBrand.save();
    res.status(201).json({ message: 'Brand added successfully', brand: newBrand });
  } catch (error) {
    console.error('Error adding brand:', error);
    res.status(500).json({ message: 'Failed to add brand', error: error.message });
  }
};
 
// Edit brand
const editBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { brandName, popularBrand } = req.body;
    if (!brandName) {
      return res.status(400).json({ message: 'Brand name is required' });
    }
    const updated = await Brand.findByIdAndUpdate(
      id,
      { brandName, popularBrand },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: 'Brand not found' });
    }
    res.status(200).json({ message: 'Brand updated successfully', brand: updated });
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ message: 'Failed to update brand', error: error.message });
  }
};
 
// Delete brand
const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Brand.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Brand not found' });
    }
    res.status(200).json({ message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({ message: 'Failed to delete brand', error: error.message });
  }
};
 
// Get all brands (for admin)
const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find();
    res.status(200).json(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ message: 'Failed to fetch brands', error: error.message });
  }
};

// Handle bulk product upload
const bulkUploadProducts = async (req, res) => {
  try {
    // Check if file is provided
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Parse the Excel file
    const XLSX = require('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    // Validate number of products
    if (jsonData.length !== 10) {
      return res.status(400).json({ message: 'Excel file must contain exactly 10 products' });
    }

    // Define required fields
    const requiredFields = ['product_id', 'name', 'brand', 'category', 'cost_price', 'retail_price'];

    // Valid categories
    const validCategories = ['Women', 'Men', 'Unisex', 'Gifts'];

    // Get existing brands
    const validBrands = await Brand.find().select('brandName');
    const validBrandNames = validBrands.map(brand => brand.brandName);

    // Validate and format products
    const formattedProducts = jsonData.map((row, index) => {
      // Check for required fields
      for (const field of requiredFields) {
        if (!row[field] && row[field] !== 0) {
          throw new Error(`Missing required field '${field}' in row ${index + 1}`);
        }
      }

      // Validate data types and constraints
      if (typeof row.product_id !== 'string' && typeof row.product_id !== 'number') {
        throw new Error(`Invalid product_id in row ${index + 1}: must be a string or number`);
      }
      if (typeof row.name !== 'string') {
        throw new Error(`Invalid name in row ${index + 1}: must be a string`);
      }
      if (typeof row.brand !== 'string') {
        throw new Error(`Invalid brand in row ${index + 1}: must be a string`);
      }
      if (!validBrandNames.includes(row.brand)) {
        throw new Error(`Invalid brand '${row.brand}' in row ${index + 1}: brand does not exist`);
      }
      if (!validCategories.includes(row.category)) {
        throw new Error(`Invalid category '${row.category}' in row ${index + 1}: must be one of ${validCategories.join(', ')}`);
      }
      if (row.rating && (typeof row.rating !== 'number' || row.rating < 0 || row.rating > 5)) {
        throw new Error(`Invalid rating in row ${index + 1}: must be a number between 0 and 5`);
      }
      if (typeof row.cost_price !== 'number' || row.cost_price < 0) {
        throw new Error(`Invalid cost_price in row ${index + 1}: must be a non-negative number`);
      }
      if (typeof row.retail_price !== 'number' || row.retail_price < 0) {
        throw new Error(`Invalid retail_price in row ${index + 1}: must be a non-negative number`);
      }
      if (row.stock_quantity && (typeof row.stock_quantity !== 'number' || row.stock_quantity < 0)) {
        throw new Error(`Invalid stock_quantity in row ${index + 1}: must be a non-negative number`);
      }
      if (row.image_url && typeof row.image_url !== 'string') {
        throw new Error(`Invalid image_url in row ${index + 1}: must be a string`);
      }
      if (row.description && typeof row.description !== 'string') {
        throw new Error(`Invalid description in row ${index + 1}: must be a string`);
      }

      return {
        product_id: row.product_id.toString(),
        name: row.name,
        brand: row.brand,
        category: row.category,
        tags: row.tags ? row.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        rating: row.rating ? parseFloat(row.rating) : 0,
        cost_price: parseFloat(row.cost_price),
        retail_price: parseFloat(row.retail_price),
        stock_quantity: row.stock_quantity ? parseInt(row.stock_quantity) : 0,
        image_url: row.image_url || '',
        description: row.description || '',
        created_at: row.created_at ? new Date(row.created_at) : new Date()
      };
    });

    // Check for duplicate product IDs in the file
    const productIds = formattedProducts.map(p => p.product_id);
    const uniqueProductIds = new Set(productIds);
    if (uniqueProductIds.size !== productIds.length) {
      return res.status(400).json({ message: 'Duplicate product IDs found in the Excel file' });
    }

    // Check for existing product IDs in the database
    const existingProducts = await Product.find({ product_id: { $in: productIds } });
    if (existingProducts.length > 0) {
      const existingIds = existingProducts.map(p => p.product_id);
      return res.status(400).json({ message: `Product IDs already exist: ${existingIds.join(', ')}` });
    }

    // Save products to the database
    const savedProducts = await Product.insertMany(formattedProducts);

    return res.status(201).json({
      message: 'Products uploaded successfully',
      products: savedProducts
    });
  } catch (error) {
    console.error('Error in bulkUploadProducts:', error);
    return res.status(400).json({ message: error.message || 'Failed to upload products' });
  }
};





///////////////////////////////////////get all user//////////////////////////////////


// Fetch all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, '_id username email role isEmailVerified'); // limit fields
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  addBrand,
  editBrand,
  deleteBrand,
  getAllBrands,
  bulkUploadProducts,
  getAllUsers,
  updateSingleProductQty
};