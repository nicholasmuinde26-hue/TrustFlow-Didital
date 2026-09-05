import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Heart, Star, Share2, Truck, Shield, RotateCcw, ChevronLeft, Plus, Minus, MessageSquare } from "lucide-react";
import { productApi, cartApi } from "../api/storefront.api";
import ReviewForm from "../components/ReviewForm";
import toast from "react-hot-toast";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const [sessionId] = useState(() => localStorage.getItem("cart_session_id"));
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Fetch product
  const { data: productData, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => productApi.getProductBySlug(slug),
    enabled: !!slug,
  });

  // Fetch product reviews
  const { data: reviewsData } = useQuery({
    queryKey: ["product-reviews", productData?.data?._id],
    queryFn: () => productApi.getProductReviews(productData?.data?._id),
    enabled: !!productData?.data?._id,
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: () => cartApi.addToCart({
      product_id: productData.data._id,
      quantity,
      variant_sku: selectedVariant?.sku || null
    }, sessionId),
    onSuccess: () => {
      toast.success("Added to cart!");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to add to cart");
    }
  });

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: (reviewData) => productApi.createReview(productData.data._id, reviewData),
    onSuccess: () => {
      toast.success("Review submitted successfully!");
      setShowReviewForm(false);
      // Refetch reviews
      queryClient.invalidateQueries(["product-reviews", productData.data._id]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to submit review");
    }
  });

  const product = productData?.data;
  const reviews = reviewsData?.data?.reviews || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Product not found</h2>
          <button
            onClick={() => window.history.back()}
            className="text-indigo-600 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const discountPercentage = product.compare_price 
    ? Math.round(((product.compare_price - product.base_price) / product.compare_price) * 100)
    : 0;

  const currentPrice = selectedVariant ? selectedVariant.price : product.base_price;
  const currentStock = selectedVariant ? selectedVariant.stock : product.stock;

  const handleAddToCart = () => {
    if (currentStock < quantity) {
      toast.error("Insufficient stock");
      return;
    }
    addToCartMutation.mutate();
  };

  const handleQuantityChange = (delta) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= currentStock) {
      setQuantity(newQuantity);
    }
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ChevronLeft size={24} className="text-slate-600 dark:text-slate-400" />
          </button>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            Product Details
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
              {product.images[selectedImage] ? (
                <img
                  src={product.images[selectedImage]}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : product.thumbnail ? (
                <img
                  src={product.thumbnail}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <span className="text-6xl">📦</span>
                </div>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === index
                        ? "border-indigo-600"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.title} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Title */}
            <div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                {product.category}
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {product.title}
              </h1>
              {product.short_description && (
                <p className="text-slate-600 dark:text-slate-400">
                  {product.short_description}
                </p>
              )}
            </div>

            {/* Rating */}
            {averageRating > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={18}
                      className={i < Math.floor(averageRating) ? "fill-amber-400 text-amber-400" : "text-slate-300"}
                    />
                  ))}
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {averageRating.toFixed(1)} ({reviews.length} reviews)
                </span>
              </div>
            )}

            {/* Price */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                  {product.currency} {currentPrice.toLocaleString()}
                </span>
                {product.compare_price && (
                  <span className="text-xl text-slate-400 line-through">
                    {product.currency} {product.compare_price.toLocaleString()}
                  </span>
                )}
              </div>
              {discountPercentage > 0 && (
                <div className="inline-block bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-sm font-bold px-3 py-1 rounded-full">
                  Save {discountPercentage}%
                </div>
              )}
            </div>

            {/* Variants */}
            {product.has_variants && product.variants.length > 0 && (
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white mb-3">Select Variant</h3>
                <div className="grid grid-cols-2 gap-2">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.sku}
                      onClick={() => {
                        setSelectedVariant(variant);
                        setQuantity(1);
                      }}
                      disabled={variant.stock === 0}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selectedVariant?.sku === variant.sku
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                      } ${variant.stock === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="font-medium text-slate-900 dark:text-white text-sm">
                        {variant.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {variant.attributes && Object.entries(variant.attributes).map(([k, v]) => `${k}: ${v}`).join(", ")}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {product.currency} {variant.price.toLocaleString()}
                      </div>
                      <div className={`text-xs mt-1 ${variant.stock > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {variant.stock > 0 ? `${variant.stock} in stock` : "Out of stock"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white mb-3">Quantity</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                  className="w-10 h-10 flex items-center justify-center bg-slate-200 dark:bg-slate-800 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus size={18} />
                </button>
                <span className="w-16 text-center font-bold text-slate-900 dark:text-white">
                  {quantity}
                </span>
                <button
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= currentStock}
                  className="w-10 h-10 flex items-center justify-center bg-slate-200 dark:bg-slate-800 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={18} />
                </button>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {currentStock} available
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleAddToCart}
                disabled={currentStock === 0 || addToCartMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart size={20} />
                {addToCartMutation.isPending ? "Adding..." : "Add to Cart"}
              </button>
              <button
                onClick={() => setIsWishlisted(!isWishlisted)}
                className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Heart
                  size={20}
                  className={isWishlisted ? "fill-rose-500 text-rose-500" : "text-slate-600 dark:text-slate-400"}
                />
              </button>
              <button className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Share2 size={20} className="text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="text-center">
                <Truck className="mx-auto text-indigo-600 mb-2" size={24} />
                <div className="text-xs font-medium text-slate-900 dark:text-white">Free Delivery</div>
              </div>
              <div className="text-center">
                <Shield className="mx-auto text-indigo-600 mb-2" size={24} />
                <div className="text-xs font-medium text-slate-900 dark:text-white">Secure Payment</div>
              </div>
              <div className="text-center">
                <RotateCcw className="mx-auto text-indigo-600 mb-2" size={24} />
                <div className="text-xs font-medium text-slate-900 dark:text-white">Easy Returns</div>
              </div>
            </div>

            {/* Description */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white mb-3">Description</h3>
              <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line">
                {product.description}
              </p>
            </div>

            {/* Specifications */}
            {product.weight || product.dimensions ? (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white mb-3">Specifications</h3>
                <div className="space-y-2">
                  {product.weight && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Weight</span>
                      <span className="font-medium text-slate-900 dark:text-white">{product.weight} kg</span>
                    </div>
                  )}
                  {product.dimensions && (
                    <>
                      {product.dimensions.length && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Length</span>
                          <span className="font-medium text-slate-900 dark:text-white">{product.dimensions.length} cm</span>
                        </div>
                      )}
                      {product.dimensions.width && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Width</span>
                          <span className="font-medium text-slate-900 dark:text-white">{product.dimensions.width} cm</span>
                        </div>
                      )}
                      {product.dimensions.height && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Height</span>
                          <span className="font-medium text-slate-900 dark:text-white">{product.dimensions.height} cm</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Customer Reviews</h2>
            <button
              onClick={() => setShowReviewForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              <MessageSquare size={18} />
              Write a Review
            </button>
          </div>

          {reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.map((review) => (
                <div
                  key={review._id}
                  className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-950 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                        {review.customer_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white text-sm">
                          {review.customer_name}
                        </div>
                        {review.verified_purchase && (
                          <div className="text-xs text-emerald-600">Verified Purchase</div>
                        )}
                      </div>
                    </div>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className={i < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}
                        />
                      ))}
                    </div>
                  </div>
                  {review.title && (
                    <h4 className="font-medium text-slate-900 dark:text-white mb-2">{review.title}</h4>
                  )}
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">{review.comment}</p>
                  {review.images && review.images.length > 0 && (
                    <div className="flex gap-2">
                      {review.images.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt="Review image"
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <MessageSquare size={48} className="text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">No reviews yet. Be the first to review this product!</p>
            </div>
          )}
        </div>
      </main>

      {/* Review Form Modal */}
      {showReviewForm && (
        <ReviewForm
          productId={product._id}
          onSubmit={(reviewData) => submitReviewMutation.mutate(reviewData)}
          onCancel={() => setShowReviewForm(false)}
        />
      )}
    </div>
  );
}