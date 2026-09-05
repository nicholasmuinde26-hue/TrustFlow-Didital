import Product, { PRODUCT_CATEGORIES } from "../../models/Product.js";
import ProductReview from "../../models/ProductReview.js";
import Business from "../../models/Business.js";
import slugify from "slugify";

/**
 * PRODUCT SERVICE
 * Advanced product catalog management similar to AliExpress/Jumia
 */

/**
 * Create a new product
 */
export async function createProduct(businessId, productData, userId) {
  const business = await Business.findById(businessId);
  if (!business) {
    const error = new Error("Business not found");
    error.statusCode = 404;
    throw error;
  }

  // Generate unique slug
  const baseSlug = slugify(productData.title);
  const slug = await generateUniqueSlug(baseSlug);

  const product = await Product.create({
    business_id: businessId,
    title: productData.title,
    description: productData.description,
    short_description: productData.short_description,
    category: productData.category,
    subcategory: productData.subcategory,
    tags: productData.tags || [],
    base_price: productData.base_price,
    compare_price: productData.compare_price,
    cost_price: productData.cost_price,
    currency: productData.currency || "KES",
    stock: productData.stock,
    stock_management: productData.stock_management !== false,
    low_stock_threshold: productData.low_stock_threshold || 5,
    has_variants: productData.has_variants || false,
    variants: productData.variants || [],
    images: productData.images || [],
    thumbnail: productData.thumbnail,
    weight: productData.weight,
    dimensions: productData.dimensions,
    shipping_required: productData.shipping_required !== false,
    shipping_weight: productData.shipping_weight,
    shipping_class: productData.shipping_class || "standard",
    slug,
    meta_title: productData.meta_title,
    meta_description: productData.meta_description,
    status: productData.status || "draft",
    visibility: productData.visibility || "public",
    is_featured: productData.is_featured || false,
    created_by: userId
  });

  return product;
}

/**
 * Generate unique slug for product
 */
async function generateUniqueSlug(baseSlug) {
  let slug = baseSlug;
  let counter = 1;
  
  while (await Product.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

/**
 * Get products with pagination for endless scrolling
 */
export async function getProducts(filters = {}, pagination = {}) {
  const {
    business_id,
    category,
    subcategory,
    status = "active",
    visibility = "public",
    search,
    min_price,
    max_price,
    in_stock,
    is_featured,
    sort_by = "created_at",
    sort_order = "desc"
  } = filters;

  const {
    page = 1,
    limit = 20,
    skip = 0
  } = pagination;

  // Build query
  const query = {
    status,
    visibility
  };

  if (business_id) query.business_id = business_id;
  if (category) query.category = category;
  if (subcategory) query.subcategory = subcategory;
  if (is_featured !== undefined) query.is_featured = is_featured;
  
  if (in_stock) {
    if (has_variants) {
      query.stock = { $gt: 0 };
    } else {
      query.$or = [
        { stock: { $gt: 0 } },
        { has_variants: true, "variants.stock": { $gt: 0 } }
      ];
    }
  }

  if (min_price !== undefined || max_price !== undefined) {
    query.base_price = {};
    if (min_price !== undefined) query.base_price.$gte = min_price;
    if (max_price !== undefined) query.base_price.$lte = max_price;
  }

  // Search functionality
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { tags: { $in: [new RegExp(search, "i")] } }
    ];
  }

  // Sorting
  const sort = {};
  const validSortFields = ["created_at", "price", "sales_count", "rating", "title"];
  const sortField = validSortFields.includes(sort_by) ? sort_by : "created_at";
  const sortOrder = sort_order === "asc" ? 1 : -1;
  
  if (sortField === "price") {
    sort.base_price = sortOrder;
  } else {
    sort[sortField] = sortOrder;
  }

  const products = await Product.find(query)
    .populate("business_id", "name currency")
    .sort(sort)
    .skip(skip)
    .limit(limit);

  const total = await Product.countDocuments(query);

  return {
    products,
    pagination: {
      page,
      limit,
      total,
      has_more: skip + limit < total,
      next_page: skip + limit < total ? page + 1 : null
    }
  };
}

/**
 * Get product by ID
 */
export async function getProductById(productId) {
  const product = await Product.findById(productId)
    .populate("business_id", "name currency location")
    .populate("created_by", "name email");
  
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  return product;
}

/**
 * Get product by slug (for public storefront)
 */
export async function getProductBySlug(slug) {
  const product = await Product.findOne({ slug, status: "active", visibility: "public" })
    .populate("business_id", "name currency location");

  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  return product;
}

/**
 * Update product
 */
export async function updateProduct(productId, updateData, userId) {
  const product = await Product.findById(productId);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  // Update fields
  if (updateData.title !== undefined) product.title = updateData.title;
  if (updateData.description !== undefined) product.description = updateData.description;
  if (updateData.short_description !== undefined) product.short_description = updateData.short_description;
  if (updateData.category !== undefined) product.category = updateData.category;
  if (updateData.subcategory !== undefined) product.subcategory = updateData.subcategory;
  if (updateData.tags !== undefined) product.tags = updateData.tags;
  if (updateData.base_price !== undefined) product.base_price = updateData.base_price;
  if (updateData.compare_price !== undefined) product.compare_price = updateData.compare_price;
  if (updateData.cost_price !== undefined) product.cost_price = updateData.cost_price;
  if (updateData.stock !== undefined) product.stock = updateData.stock;
  if (updateData.low_stock_threshold !== undefined) product.low_stock_threshold = updateData.low_stock_threshold;
  if (updateData.images !== undefined) product.images = updateData.images;
  if (updateData.thumbnail !== undefined) product.thumbnail = updateData.thumbnail;
  if (updateData.weight !== undefined) product.weight = updateData.weight;
  if (updateData.dimensions !== undefined) product.dimensions = updateData.dimensions;
  if (updateData.shipping_required !== undefined) product.shipping_required = updateData.shipping_required;
  if (updateData.shipping_weight !== undefined) product.shipping_weight = updateData.shipping_weight;
  if (updateData.shipping_class !== undefined) product.shipping_class = updateData.shipping_class;
  if (updateData.meta_title !== undefined) product.meta_title = updateData.meta_title;
  if (updateData.meta_description !== undefined) product.meta_description = updateData.meta_description;
  if (updateData.status !== undefined) product.status = updateData.status;
  if (updateData.visibility !== undefined) product.visibility = updateData.visibility;
  if (updateData.is_featured !== undefined) product.is_featured = updateData.is_featured;
  if (updateData.variants !== undefined) product.variants = updateData.variants;
  if (updateData.has_variants !== undefined) product.has_variants = updateData.has_variants;

  product.updated_by = userId;
  product.updated_at = new Date();

  await product.save();
  return product;
}

/**
 * Delete product (soft delete - archive)
 */
export async function deleteProduct(productId) {
  const product = await Product.findById(productId);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  product.status = "archived";
  await product.save();
  return product;
}

/**
 * Get product categories
 */
export function getProductCategories() {
  return PRODUCT_CATEGORIES;
}

/**
 * Get product reviews
 */
export async function getProductReviews(productId, pagination = {}) {
  const { page = 1, limit = 10 } = pagination;
  const skip = (page - 1) * limit;

  const reviews = await ProductReview.find({
    product_id: productId,
    status: "approved"
  })
    .sort({ helpful_count: -1, created_at: -1 })
    .skip(skip)
    .limit(limit);

  const total = await ProductReview.countDocuments({
    product_id: productId,
    status: "approved"
  });

  return {
    reviews,
    pagination: {
      page,
      limit,
      total,
      has_more: skip + limit < total
    }
  };
}

/**
 * Create product review
 */
export async function createProductReview(productId, reviewData) {
  const product = await Product.findById(productId);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  const review = await ProductReview.create({
    product_id: productId,
    business_id: product.business_id,
    customer_name: reviewData.customer_name,
    customer_email: reviewData.customer_email,
    customer_phone: reviewData.customer_phone,
    rating: reviewData.rating,
    title: reviewData.title,
    comment: reviewData.comment,
    images: reviewData.images || [],
    verified_purchase: reviewData.verified_purchase || false,
    order_id: reviewData.order_id
  });

  // Update product rating
  await updateProductRating(productId);

  return review;
}

/**
 * Update product rating based on reviews
 */
async function updateProductRating(productId) {
  const reviews = await ProductReview.find({
    product_id: productId,
    status: "approved"
  });

  if (reviews.length === 0) {
    await Product.findByIdAndUpdate(productId, {
      rating: 0,
      review_count: 0
    });
    return;
  }

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;

  await Product.findByIdAndUpdate(productId, {
    rating: Math.round(averageRating * 10) / 10,
    review_count: reviews.length
  });
}

/**
 * Search products
 */
export async function searchProducts(searchTerm, filters = {}, pagination = {}) {
  const {
    business_id,
    category,
    min_price,
    max_price,
    in_stock
  } = filters;

  const query = {
    status: "active",
    visibility: "public",
    $or: [
      { title: { $regex: searchTerm, $options: "i" } },
      { description: { $regex: searchTerm, $options: "i" } },
      { tags: { $in: [new RegExp(searchTerm, "i")] } }
    ]
  };

  if (business_id) query.business_id = business_id;
  if (category) query.category = category;
  if (min_price !== undefined || max_price !== undefined) {
    query.base_price = {};
    if (min_price !== undefined) query.base_price.$gte = min_price;
    if (max_price !== undefined) query.base_price.$lte = max_price;
  }
  if (in_stock) query.stock = { $gt: 0 };

  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const products = await Product.find(query)
    .populate("business_id", "name currency")
    .sort({ sales_count: -1, rating: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Product.countDocuments(query);

  return {
    products,
    pagination: {
      page,
      limit,
      total,
      has_more: skip + limit < total
    }
  };
}