import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  ShoppingCart, 
  Package, 
  Printer, 
  Search, 
  X, 
  Minus, 
  LayoutDashboard,
  Menu,
  ChevronRight,
  Settings as SettingsIcon,
  Save,
  Download,
  Upload
} from "lucide-react";
import { cn, formatCurrency } from "./lib/utils";
import { EscPos, printToBluetooth } from "./lib/escpos";
import { motion, AnimatePresence } from "motion/react";

// Types
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  createdAt: number;
}

interface CartItem extends Product {
  quantity: number;
}

interface Settings {
  pb1Rate: number;
  scRate: number;
  storeName: string;
  storeAddress: string;
  logoUrl: string;
}

// Local Storage Helpers
const STORAGE_KEYS = {
  PRODUCTS: "pos_products",
  SETTINGS: "pos_settings",
  TRANSACTIONS: "pos_transactions"
};

const getLocal = <T,>(key: string, defaultValue: T): T => {
  const saved = localStorage.getItem(key);
  if (!saved) return defaultValue;
  try {
    return JSON.parse(saved);
  } catch {
    return defaultValue;
  }
};

const setLocal = <T,>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => getLocal(STORAGE_KEYS.PRODUCTS, []));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [view, setView] = useState<"sales" | "products" | "settings">("sales");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => getLocal(STORAGE_KEYS.SETTINGS, {
    pb1Rate: 10,
    scRate: 0,
    storeName: "POS PINTAR",
    storeAddress: "Jl. Contoh No. 123",
    logoUrl: ""
  }));

  // Sync to Local Storage
  useEffect(() => {
    setLocal(STORAGE_KEYS.PRODUCTS, products);
  }, [products]);

  useEffect(() => {
    setLocal(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);

  // Demo Data if empty
  useEffect(() => {
    if (products.length === 0) {
      const demoProducts = [
        { id: "1", name: "MIE GACOAN", price: 11364, stock: 50, category: "Makanan", createdAt: Date.now() },
        { id: "2", name: "UDANG KEJU", price: 10455, stock: 30, category: "Makanan", createdAt: Date.now() - 1000 },
        { id: "3", name: "THAI TEA", price: 9091, stock: 40, category: "Minuman", createdAt: Date.now() - 2000 }
      ];
      setProducts(demoProducts);
    }
  }, []);

  // Cart Logic
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const clearCart = () => setCart([]);

  const generateReceiptNo = () => {
    const now = new Date();
    const dateStr = now.getFullYear().toString().slice(-2) + 
                    (now.getMonth() + 1).toString().padStart(2, '0') + 
                    now.getDate().toString().padStart(2, '0');
    const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
    return `TRX-${dateStr}-${randomStr}`;
  };

  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    receiptNo: generateReceiptNo()
  });

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
  
  const sc = Math.round(cartTotal * (settings.scRate / 100));
  const pb1 = Math.round(cartTotal * (settings.pb1Rate / 100));
  const rawGrandTotal = cartTotal + sc + pb1;
  const grandTotal = Math.ceil(rawGrandTotal / 1000) * 1000;
  const rounding = grandTotal - rawGrandTotal;

  // Product CRUD
  const handleSaveProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      price: Number(formData.get("price")),
      stock: Number(formData.get("stock")),
      category: formData.get("category") as string,
    };

    if (editingProduct) {
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...data } : p));
    } else {
      const newProduct: Product = {
        ...data,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: Date.now()
      };
      setProducts(prev => [newProduct, ...prev]);
    }
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleDeleteProduct = (id: string) => {
    if (window.confirm("Hapus produk ini?")) {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  // Printing Logic
  const handlePrint = async () => {
    if (cart.length === 0) return;
    setIsPrinting(true);
    try {
      const finalCustomerInfo = {
        ...customerInfo,
        name: customerInfo.name.trim() || "cust",
        phone: customerInfo.phone.trim() || "-"
      };

      const escpos = new EscPos();
      await escpos.receiptHeader(settings.storeName, settings.storeAddress, settings.logoUrl);
      escpos.receiptOrderInfo({
        name: finalCustomerInfo.name,
        phone: finalCustomerInfo.phone,
        receiptNo: finalCustomerInfo.receiptNo
      });
      escpos.receiptItemHeader();
      cart.forEach(item => {
        escpos.receiptItem(item.name, item.quantity, item.price);
      });
      escpos.receiptFooter({
        total: cartTotal,
        sc,
        pb1,
        rounding,
        grandTotal
      });

      // Update stock locally
      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(c => c.id === p.id);
        if (cartItem) {
          return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
        }
        return p;
      }));

      const buffer = escpos.getBuffer();
      await printToBluetooth(buffer);

      // Update stock locally
      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(c => c.id === p.id);
        if (cartItem) {
          return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
        }
        return p;
      }));

      clearCart();
      setCustomerInfo(prev => ({ ...prev, receiptNo: generateReceiptNo() }));
    } catch (err: any) {
      console.error("Print error:", err);
      alert(err.message || "Gagal mencetak struk.");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings(prev => ({ ...prev, logoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newSettings = {
      storeName: formData.get("storeName") as string,
      storeAddress: formData.get("storeAddress") as string,
      pb1Rate: Number(formData.get("pb1Rate")),
      scRate: Number(formData.get("scRate")),
      logoUrl: settings.logoUrl,
    };
    setSettings(newSettings);
    alert("Pengaturan berhasil disimpan secara lokal!");
  };

  const exportData = () => {
    const data = {
      products,
      settings,
      version: "1.0",
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pos_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.products) setProducts(data.products);
        if (data.settings) setSettings(data.settings);
        alert("Data berhasil diimpor!");
      } catch (err) {
        alert("Gagal mengimpor data. Format file tidak valid.");
      }
    };
    reader.readAsText(file);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#E4E3E0] font-sans text-[#1a1a1a] selection:bg-[#5A5A40] selection:text-white">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 bottom-0 w-20 md:w-24 bg-white border-r border-gray-100 flex flex-col items-center py-8 z-50">
        <div className="w-12 h-12 bg-[#5A5A40] rounded-2xl flex items-center justify-center mb-12 shadow-lg shadow-[#5A5A40]/20">
          <LayoutDashboard className="text-white w-6 h-6" />
        </div>
        
        <nav className="flex flex-col gap-8">
          <button 
            onClick={() => setView("sales")}
            className={cn(
              "p-4 rounded-2xl transition-all duration-300",
              view === "sales" ? "bg-[#F5F5F0] text-[#5A5A40] shadow-sm" : "text-gray-300 hover:text-[#5A5A40]"
            )}
          >
            <ShoppingCart className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setView("products")}
            className={cn(
              "p-4 rounded-2xl transition-all duration-300",
              view === "products" ? "bg-[#F5F5F0] text-[#5A5A40] shadow-sm" : "text-gray-300 hover:text-[#5A5A40]"
            )}
          >
            <Package className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setView("settings")}
            className={cn(
              "p-4 rounded-2xl transition-all duration-300",
              view === "settings" ? "bg-[#F5F5F0] text-[#5A5A40] shadow-sm" : "text-gray-300 hover:text-[#5A5A40]"
            )}
          >
            <SettingsIcon className="w-6 h-6" />
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          <label className="p-4 rounded-2xl text-gray-300 hover:text-[#5A5A40] cursor-pointer transition-all">
            <Upload className="w-6 h-6" />
            <input type="file" accept=".json" onChange={importData} className="hidden" />
          </label>
          <button 
            onClick={exportData}
            className="p-4 rounded-2xl text-gray-300 hover:text-[#5A5A40] transition-all"
            title="Export Data"
          >
            <Download className="w-6 h-6" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-20 md:pl-24 min-h-screen">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 px-6 md:px-12 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-black tracking-tight text-[#1a1a1a]">
              {view === "sales" ? "Kasir" : view === "products" ? "Manajemen Produk" : "Pengaturan Toko"}
            </h1>
            <p className="text-[#5A5A40] text-xs font-medium uppercase tracking-widest mt-1">
              {settings.storeName} • {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group flex-1 md:flex-none">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#5A5A40] transition-colors" />
              <input 
                type="text"
                placeholder="Cari produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full md:w-64 bg-[#F5F5F0] border-none rounded-2xl py-3 pl-12 pr-6 focus:ring-2 focus:ring-[#5A5A40] transition-all text-sm"
              />
            </div>
            {view === "sales" && (
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative p-3 bg-white border border-gray-100 rounded-2xl hover:bg-[#F5F5F0] transition-all md:hidden"
              >
                <ShoppingCart className="w-6 h-6 text-[#5A5A40]" />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </button>
            )}
          </div>
        </header>

        <div className="p-6 md:p-12">
          {view === "sales" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
              {/* Product Grid */}
              <div className="lg:col-span-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {filteredProducts.map((product) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className="group bg-white rounded-[32px] p-5 md:p-6 cursor-pointer hover:shadow-xl hover:shadow-[#5A5A40]/5 transition-all duration-500 border border-transparent hover:border-[#F5F5F0]"
                    >
                      <div className="aspect-square bg-[#F5F5F0] rounded-2xl mb-4 md:mb-6 flex items-center justify-center group-hover:scale-95 transition-transform duration-500 overflow-hidden relative">
                        <Package className="w-8 h-8 md:w-10 md:h-10 text-[#5A5A40]/20" />
                        <div className="absolute inset-0 bg-[#5A5A40]/0 group-hover:bg-[#5A5A40]/5 transition-colors" />
                      </div>
                      <h3 className="font-bold text-[#1a1a1a] text-sm md:text-base mb-1 line-clamp-1">{product.name}</h3>
                      <p className="text-[#5A5A40] font-serif italic text-xs mb-3">{product.category}</p>
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm md:text-lg">{formatCurrency(product.price)}</span>
                        <div className="w-8 h-8 bg-[#F5F5F0] rounded-full flex items-center justify-center group-hover:bg-[#5A5A40] group-hover:text-white transition-all duration-500">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Desktop Cart Sidebar */}
              <div className="hidden lg:block lg:col-span-4">
                <div className="bg-white rounded-[40px] p-8 md:p-10 sticky top-32 shadow-sm border border-gray-50">
                  <CartContent 
                    cart={cart}
                    updateQuantity={updateQuantity}
                    removeFromCart={removeFromCart}
                    customerInfo={customerInfo}
                    setCustomerInfo={setCustomerInfo}
                    cartTotal={cartTotal}
                    sc={sc}
                    pb1={pb1}
                    rounding={rounding}
                    grandTotal={grandTotal}
                    handlePrint={handlePrint}
                    isPrinting={isPrinting}
                    pb1Rate={settings.pb1Rate}
                  />
                </div>
              </div>
            </div>
          ) : view === "products" ? (
            <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-sm border border-gray-50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 md:mb-12">
                <div>
                  <h2 className="text-2xl font-serif font-black text-[#1a1a1a]">Daftar Produk</h2>
                  <p className="text-gray-400 text-sm mt-1">Kelola stok dan harga menu Anda</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingProduct(null);
                    setIsModalOpen(true);
                  }}
                  className="bg-[#5A5A40] text-white px-8 py-4 rounded-full font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#5A5A40]/20"
                >
                  <Plus className="w-5 h-5" />
                  Tambah Produk
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[#5A5A40] text-xs font-bold uppercase tracking-widest border-bottom border-gray-100">
                      <th className="pb-6 px-4 md:px-0">Produk</th>
                      <th className="pb-6">Kategori</th>
                      <th className="pb-6">Harga</th>
                      <th className="pb-6">Stok</th>
                      <th className="pb-6 text-right px-4 md:px-0">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="group hover:bg-[#F5F5F0]/50 transition-all">
                        <td className="py-6 px-4 md:px-0 font-bold text-[#1a1a1a]">{product.name}</td>
                        <td className="py-6 text-[#5A5A40] font-serif italic text-sm">{product.category}</td>
                        <td className="py-6 font-black text-sm">{formatCurrency(product.price)}</td>
                        <td className="py-6">
                          <span className={cn(
                            "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            product.stock > 10 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                          )}>
                            {product.stock} Unit
                          </span>
                        </td>
                        <td className="py-6 text-right px-4 md:px-0">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => {
                                setEditingProduct(product);
                                setIsModalOpen(true);
                              }}
                              className="p-3 text-gray-300 hover:text-[#5A5A40] hover:bg-white rounded-xl transition-all"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-3 text-gray-300 hover:text-red-500 hover:bg-white rounded-xl transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto bg-white rounded-[40px] p-8 md:p-12 shadow-sm border border-gray-50">
              <div className="mb-10">
                <h2 className="text-2xl font-serif font-black text-[#1a1a1a]">Informasi Toko</h2>
                <p className="text-gray-400 text-sm mt-1">Sesuaikan identitas struk dan pajak</p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-[#5A5A40] mb-3 uppercase tracking-widest">Nama Toko</label>
                    <input 
                      name="storeName"
                      defaultValue={settings.storeName}
                      required
                      className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5A5A40] mb-3 uppercase tracking-widest">Alamat Toko</label>
                    <textarea 
                      name="storeAddress"
                      defaultValue={settings.storeAddress}
                      required
                      rows={3}
                      className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all resize-none font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="block text-xs font-bold text-[#5A5A40] mb-3 uppercase tracking-widest">PB1 (Pajak %)</label>
                    <div className="relative">
                      <input 
                        name="pb1Rate"
                        type="number"
                        defaultValue={settings.pb1Rate}
                        required
                        min="0"
                        max="100"
                        className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold"
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-[#5A5A40]">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5A5A40] mb-3 uppercase tracking-widest">Service Charge (%)</label>
                    <div className="relative">
                      <input 
                        name="scRate"
                        type="number"
                        defaultValue={settings.scRate}
                        required
                        min="0"
                        max="100"
                        className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold"
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-[#5A5A40]">%</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-[#5A5A40] mb-3 uppercase tracking-widest">Logo Toko (Opsional)</label>
                    <div className="flex items-center gap-6 p-6 bg-[#F5F5F0] rounded-3xl border-2 border-dashed border-gray-200">
                      {settings.logoUrl ? (
                        <div className="relative group">
                          <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-sm">
                            <img src={settings.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                          </div>
                          <button 
                            type="button" 
                            onClick={() => setSettings({ ...settings, logoUrl: "" })}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-200">
                          <SettingsIcon className="w-8 h-8 text-gray-200" />
                        </div>
                      )}
                      <div className="flex-1">
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="w-full text-xs text-gray-400 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#5A5A40] file:text-white hover:file:opacity-90 cursor-pointer"
                        />
                        <p className="text-[10px] text-gray-400 mt-3 italic">Format PNG/JPG, latar belakang putih/transparan disarankan.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-[#5A5A40] text-white rounded-full py-5 font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl shadow-[#5A5A40]/20"
                >
                  <Save className="w-5 h-5" />
                  Simpan Pengaturan
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white p-6 md:p-8 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-serif font-black">Keranjang</h2>
                <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-[#F5F5F0] rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-hidden">
                <CartContent 
                  cart={cart}
                  updateQuantity={updateQuantity}
                  removeFromCart={removeFromCart}
                  customerInfo={customerInfo}
                  setCustomerInfo={setCustomerInfo}
                  cartTotal={cartTotal}
                  sc={sc}
                  pb1={pb1}
                  rounding={rounding}
                  grandTotal={grandTotal}
                  handlePrint={handlePrint}
                  isPrinting={isPrinting}
                  pb1Rate={settings.pb1Rate}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[40px] p-8 md:p-12 shadow-2xl"
            >
              <h3 className="text-2xl font-serif font-black text-[#1a1a1a] mb-8">
                {editingProduct ? "Edit Produk" : "Tambah Produk Baru"}
              </h3>
              <form onSubmit={handleSaveProduct} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-[#5A5A40] mb-3 uppercase tracking-widest">Nama Produk</label>
                  <input 
                    name="name"
                    defaultValue={editingProduct?.name}
                    required
                    className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold"
                    placeholder="Contoh: Kopi Susu"
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#5A5A40] mb-3 uppercase tracking-widest">Harga</label>
                    <input 
                      name="price"
                      type="number"
                      defaultValue={editingProduct?.price}
                      required
                      className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5A5A40] mb-3 uppercase tracking-widest">Stok</label>
                    <input 
                      name="stock"
                      type="number"
                      defaultValue={editingProduct?.stock}
                      required
                      className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5A5A40] mb-3 uppercase tracking-widest">Kategori</label>
                  <select 
                    name="category"
                    defaultValue={editingProduct?.category}
                    className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all appearance-none font-bold"
                  >
                    <option value="Makanan">Makanan</option>
                    <option value="Minuman">Minuman</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="order-2 sm:order-1 flex-1 bg-gray-50 text-gray-400 rounded-full py-4 font-bold hover:bg-gray-100 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="order-1 sm:order-2 flex-[2] bg-[#5A5A40] text-white rounded-full py-4 px-10 font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-[#5A5A40]/20"
                  >
                    Simpan Produk
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CartContent({ 
  cart, 
  updateQuantity, 
  removeFromCart, 
  customerInfo, 
  setCustomerInfo,
  cartTotal,
  sc,
  pb1,
  rounding,
  grandTotal,
  handlePrint,
  isPrinting,
  pb1Rate
}: any) {
  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="col-span-2">
          <label className="block text-[10px] font-bold text-[#5A5A40] mb-1 uppercase tracking-widest">No. Struk</label>
          <input 
            type="text" 
            placeholder="No. Struk" 
            value={customerInfo.receiptNo}
            onChange={(e) => setCustomerInfo({ ...customerInfo, receiptNo: e.target.value })}
            className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 text-xs font-bold focus:ring-1 focus:ring-[#5A5A40]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#5A5A40] mb-1 uppercase tracking-widest">Nama Pelanggan</label>
          <input 
            type="text" 
            placeholder="Nama" 
            value={customerInfo.name}
            onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
            className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 text-xs font-bold focus:ring-1 focus:ring-[#5A5A40]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#5A5A40] mb-1 uppercase tracking-widest">Telepon</label>
          <input 
            type="text" 
            placeholder="Telepon" 
            value={customerInfo.phone}
            onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
            className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-4 text-xs font-bold focus:ring-1 focus:ring-[#5A5A40]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6 mb-8 min-h-[150px]">
        <AnimatePresence mode="popLayout">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-300 font-serif italic text-sm">
              Keranjang kosong
            </div>
          ) : (
            cart.map((item: any) => (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                key={item.id} 
                className="flex items-center gap-4 group"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[#1a1a1a] text-sm truncate">{item.name}</h4>
                  <p className="text-[10px] text-[#5A5A40] font-serif italic">{formatCurrency(item.price)}</p>
                </div>
                <div className="flex items-center gap-3 bg-[#F5F5F0] rounded-full px-3 py-1.5">
                  <button onClick={() => updateQuantity(item.id, -1)} className="text-[#5A5A40] hover:text-black transition-colors">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-black text-xs w-4 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="text-[#5A5A40] hover:text-black transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-gray-200 hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <div className="pt-8 border-t border-gray-100 space-y-3">
        <div className="flex justify-between text-xs text-[#5A5A40] font-medium">
          <span>Subtotal</span>
          <span>{formatCurrency(cartTotal)}</span>
        </div>
        {sc > 0 && (
          <div className="flex justify-between text-xs text-[#5A5A40] font-medium">
            <span>Service Charge</span>
            <span>{formatCurrency(sc)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs text-[#5A5A40] font-medium">
          <span>PB1 ({pb1Rate}%)</span>
          <span>{formatCurrency(pb1)}</span>
        </div>
        {rounding !== 0 && (
          <div className="flex justify-between text-xs text-[#5A5A40] font-medium">
            <span>Pembulatan</span>
            <span>{formatCurrency(rounding)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-black text-[#1a1a1a] pt-2">
          <span>Total</span>
          <span>{formatCurrency(grandTotal)}</span>
        </div>
        
        <button 
          onClick={handlePrint}
          disabled={cart.length === 0 || isPrinting}
          className="w-full bg-[#5A5A40] text-white rounded-full py-5 mt-6 font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl shadow-[#5A5A40]/20 disabled:opacity-50 disabled:shadow-none"
        >
          {isPrinting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Printer className="w-5 h-5" />
          )}
          Cetak Struk
        </button>
      </div>
    </div>
  );
}
