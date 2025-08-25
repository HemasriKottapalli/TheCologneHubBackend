const express = require("express");
  const router = express.Router();
  const verifyToken = require("../middlewares/authMiddleware");
  const authorizeRoles = require("../middlewares/roleMiddleware");
  const {
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

  } = require("../controllers/adminController");
  const upload = require("../middlewares/upload"); // import upload middleware


  ////////////////product management routes //////////////////


  // Create Product
  router.post("/products", verifyToken, authorizeRoles("admin"), upload.single("image"),createProduct);
  router.post("/bulkupload", verifyToken, authorizeRoles("admin"), bulkUploadProducts);


  // Get All Products
  router.get("/products", verifyToken, authorizeRoles("admin"), getAllProducts);

  // Get Single Product
  router.get("/products/:id", verifyToken, authorizeRoles("admin"), getProductById);

  // Update Product
  router.put("/products/:id", verifyToken, authorizeRoles("admin"),upload.single("image"), updateProduct);

  // Delete Product
  router.delete("/products/:id", verifyToken, authorizeRoles("admin"), deleteProduct);


  ///////////////////// brand mangement routes //////////////////////////////
  router.post('/brands', verifyToken, authorizeRoles("admin"), addBrand);
  router.put('/brands/:id', verifyToken, authorizeRoles("admin"), editBrand);
  router.delete('/brands/:id', verifyToken, authorizeRoles("admin"), deleteBrand);
  router.get('/brands/all',verifyToken, authorizeRoles("admin"), getAllBrands);

  ///////////////////get all uusers/////////////////////
  router.get('/getAllUsers',verifyToken, authorizeRoles("admin"), getAllUsers);
  router.post('/UpdateProductQty',verifyToken, authorizeRoles("admin"), updateSingleProductQty);



  module.exports = router;