import { ShoppingCart, X, Plus, Minus, Trash2, CreditCard } from "lucide-react";

export default function ShoppingCartSidebar({ cart, isOpen, onClose, onUpdateQuantity, onRemoveItem, onClearCart, onCheckout }) {
  if (!isOpen) return null;

  const itemCount = cart?.items?.length || 0;
  const subtotal = cart?.subtotal || 0;
  const discount = cart?.discount_amount || 0;
  const tax = cart?.tax_amount || 0;
  const shipping = cart?.shipping_amount || 0;
  const total = cart?.total || 0;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <ShoppingCart className="text-indigo-600" size={24} />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Shopping Cart ({itemCount})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {itemCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingCart size={48} className="text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Your cart is empty
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                Add some products to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.items.map((item) => (
                <div
                  key={item._id}
                  className="flex gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                >
                  {/* Product Image */}
                  <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-lg overflow-hidden flex-shrink-0">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        📦
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-900 dark:text-white text-sm line-clamp-2 mb-1">
                      {item.name}
                    </h4>
                    {item.attributes && Object.keys(item.attributes).length > 0 && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        {Object.entries(item.attributes).map(([key, value]) => (
                          <span key={key} className="mr-2">
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="font-bold text-indigo-600 dark:text-indigo-400">
                      {cart.currency} {item.price.toLocaleString()}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => onRemoveItem(item._id)}
                      className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950 rounded transition-colors"
                    >
                      <Trash2 size={16} className="text-rose-500" />
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQuantity(item._id, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-medium text-slate-900 dark:text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item._id, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Summary */}
        {itemCount > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {cart.currency} {subtotal.toLocaleString()}
              </span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-emerald-600">Discount</span>
                <span className="font-medium text-emerald-600">
                  -{cart.currency} {discount.toLocaleString()}
                </span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Tax (16%)</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {cart.currency} {tax.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Shipping</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {cart.currency} {shipping.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-lg font-bold pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-slate-900 dark:text-white">Total</span>
              <span className="text-indigo-600 dark:text-indigo-400">
                {cart.currency} {total.toLocaleString()}
              </span>
            </div>

            <button
              onClick={onCheckout}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
            >
              <CreditCard size={20} />
              Proceed to Checkout
            </button>

            <button
              onClick={onClearCart}
              className="w-full text-sm text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}