// controllers/product.controller.js
const XLSX = require("xlsx");
const Product = require("../models/Product");
const path = require("path");

// ✅ Bulk Upload Products
exports.uploadProducts = async (req, res) => {
  try {
    console.log("📥 Upload endpoint hit");

    if (!req.file) {
      console.log("❌ No file received");
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("✅ File received:", req.file.originalname, "size:", req.file.size);

    const ext = path.extname(req.file.originalname).toLowerCase();
    let workbook;

    try {
      if ([".xlsx", ".xls", ".csv"].includes(ext)) {
        workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      } else {
        return res.status(400).json({ error: "Unsupported file format" });
      }
    } catch (parseErr) {
      console.error("❌ Excel parsing failed:", parseErr);
      return res.status(500).json({ error: "Excel parsing failed: " + parseErr.message });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (!data.length) {
      console.log("❌ No rows found in sheet");
      return res.status(400).json({ error: "No data found in uploaded file" });
    }

    console.log("✅ Parsed rows:", data.length);
    console.log("🔎 Sample row:", data[0]);

    // Prepare bulk operations
    const operations = data.map((row) => ({
      updateOne: {
        filter: { product_id: row.product_id },
        update: {
          $set: {
            name: row.name,
            brand: row.brand,
            category: row.category,
            tags: row.tags ? row.tags.split(",") : [],
            rating: row.rating,
            cost_price: row.cost_price,
            retail_price: row.retail_price,
            stock_quantity: row.stock_quantity,
            image_url: row.image_url,
            description: row.description,
          },
        },
        upsert: true,
      },
    }));

    console.log("🛠 Bulk operations prepared:", operations.length);

    const result = await Product.bulkWrite(operations, { ordered: false });

    console.log("✅ Bulk write result:", result);

    res.json({
      message: "Products uploaded successfully",
      inserted: result.upsertedCount,
      updated: result.modifiedCount,
    });
  } catch (err) {
    console.error("❌ Upload route failed:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Download Products
exports.downloadProducts = async (req, res) => {
  try {
    let products = await Product.find().lean();

    if (!products || products.length === 0) {
      return res.status(404).json({ error: "No products found" });
    }

    // Convert tags array → string
    products = products.map((p) => ({
      ...p,
      tags: Array.isArray(p.tags) ? p.tags.join(",") : p.tags,
    }));

    const worksheet = XLSX.utils.json_to_sheet(products);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    res.setHeader("Content-Disposition", "attachment; filename=products.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    res.send(excelBuffer);
  } catch (err) {
    console.error("❌ Download failed:", err);
    res.status(500).json({ error: err.message });
  }
};