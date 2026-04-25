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
  Upload,
  FileText,
  Monitor,
  Clock,
  ChevronLeft
} from "lucide-react";
import { cn, formatCurrency } from "./lib/utils";
import { EscPos, requestPrinter, printToBluetooth } from "./lib/escpos";
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useRef } from "react";

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

interface Transaction {
  id: string;
  receiptNo: string;
  timestamp: number;
  items: CartItem[];
  subtotal: number;
  sc: number;
  pb1: number;
  rounding: number;
  grandTotal: number;
  customerInfo: {
    name: string;
    phone: string;
    receiptNo: string;
  };
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
    const parsed = JSON.parse(saved);
    return (parsed === null || parsed === undefined) ? defaultValue : parsed;
  } catch {
    return defaultValue;
  }
};

const setLocal = <T,>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

// Product Card Component for manual quantity
const ProductCard = ({ product, onAdd }: { product: Product, onAdd: (p: Product, q: number) => void, key?: any }) => {
  const [qty, setQty] = useState(1);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group bg-white rounded-2xl md:rounded-[32px] p-4 md:p-6 hover:shadow-xl hover:shadow-[#5A5A40]/5 transition-all duration-300 border border-transparent hover:border-[#F5F5F0] flex flex-col h-full"
    >
      <div className="flex-1">
        <h3 className="font-bold text-[#1a1a1a] text-sm md:text-base mb-0.5 line-clamp-1 group-hover:text-[#5A5A40] transition-colors">{product.name}</h3>
        <p className="text-gray-400 font-serif italic text-[10px] md:text-xs mb-3">{product.category}</p>
        <span className="font-black text-xs md:text-sm">{formatCurrency(product.price)}</span>
      </div>
      
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center bg-[#F5F5F0] rounded-lg px-2 py-1 flex-1">
          <button 
            onClick={() => setQty(prev => Math.max(1, prev - 1))}
            className="p-1 text-[#5A5A40] hover:text-black transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input 
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onAdd(product, qty);
                setQty(1);
              }
            }}
            className="w-full bg-transparent border-none text-center font-bold text-xs p-0 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button 
            onClick={() => setQty(prev => prev + 1)}
            className="p-1 text-[#5A5A40] hover:text-black transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <button 
          onClick={() => {
            onAdd(product, qty);
            setQty(1); // Reset after adding
          }}
          className="w-10 h-10 bg-[#F5F5F0] rounded-xl flex items-center justify-center group-hover:bg-[#5A5A40] group-hover:text-white transition-all duration-300 active:scale-90"
          title="Tambah ke Keranjang"
        >
          <ShoppingCart className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => getLocal(STORAGE_KEYS.PRODUCTS, []));
  const [transactions, setTransactions] = useState<Transaction[]>(() => getLocal(STORAGE_KEYS.TRANSACTIONS, []));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [view, setView] = useState<"sales" | "products" | "settings" | "history">("sales");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [btDevice, setBtDevice] = useState<any>(null);
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

  useEffect(() => {
    setLocal(STORAGE_KEYS.TRANSACTIONS, transactions);
  }, [transactions]);

  // Demo Data if empty
  useEffect(() => {
    if ((products?.length || 0) === 0) {
      const demoProducts = [
        { id: "1", name: "MIE GACOAN", price: 11364, stock: 50, category: "Makanan", createdAt: Date.now() },
        { id: "2", name: "UDANG KEJU", price: 10455, stock: 30, category: "Makanan", createdAt: Date.now() - 1000 },
        { id: "3", name: "THAI TEA", price: 9091, stock: 40, category: "Minuman", createdAt: Date.now() - 2000 }
      ];
      setProducts(demoProducts);
    }
  }, []);

  // Cart Logic
  const addToCart = (product: Product, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { ...product, quantity }];
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

  const setQuantity = (productId: string, quantity: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, quantity: Math.max(1, quantity) };
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

  const receiptRef = useRef<HTMLDivElement>(null);
  const [reprintTransaction, setReprintTransaction] = useState<Transaction | null>(null);

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
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // Printing Logic
  const handlePrint = async (tx?: Transaction) => {
    const isReprint = !!tx;
    const items = (isReprint ? tx?.items : cart) || [];
    const info = isReprint ? tx?.customerInfo : customerInfo;
    const txTotal = isReprint ? tx?.subtotal : cartTotal;
    const txSc = isReprint ? tx?.sc : sc;
    const txPb1 = isReprint ? tx?.pb1 : pb1;
    const txRounding = isReprint ? tx?.rounding : rounding;
    const txGrandTotal = isReprint ? tx?.grandTotal : grandTotal;

    if ((items?.length || 0) === 0) return;
    
    setIsPrinting(true);
    try {
      let device = btDevice;
      if (!device) {
        try {
          device = await requestPrinter();
          setBtDevice(device);
          device.addEventListener('gattserverdisconnected', () => {
            setBtDevice(null);
          });
        } catch (pickErr: any) {
          setIsPrinting(false);
          // Only alert if it's a real error, not just a cancellation
          if (!pickErr.message.includes("cancelled") && !pickErr.message.includes("dibatalkan")) {
            alert(`Gagal menyambung: ${pickErr.message}`);
          }
          return;
        }
      }

      // Update status for user
      console.log("Connecting to printer...");
      
      const finalCustomerInfo = {
        name: (info?.name || "").trim() || "cust",
        phone: (info?.phone || "").trim() || "-",
        receiptNo: info?.receiptNo || customerInfo.receiptNo
      };

      const escpos = new EscPos();
      await escpos.receiptHeader(settings.storeName, settings.storeAddress, settings.logoUrl);
      escpos.receiptOrderInfo({
        name: finalCustomerInfo.name,
        phone: finalCustomerInfo.phone,
        receiptNo: finalCustomerInfo.receiptNo,
        timestamp: isReprint ? tx?.timestamp : Date.now()
      });
      if (isReprint) {
        escpos.align("center").bold(true).line("REPRINT STRUK").bold(false).align("left");
      }
      escpos.receiptItemHeader();
      items.forEach(item => {
        escpos.receiptItem(item.name, item.quantity, item.price);
      });
      escpos.receiptFooter({
        total: txTotal,
        sc: txSc,
        pb1: txPb1,
        rounding: txRounding,
        grandTotal: txGrandTotal
      }, settings.pb1Rate);

      const buffer = escpos.getBuffer();
      await printToBluetooth(device, buffer);

      if (!isReprint) {
        // Save transaction
        const newTransaction: Transaction = {
          id: Date.now().toString(),
          receiptNo: finalCustomerInfo.receiptNo,
          timestamp: Date.now(),
          items: [...cart],
          subtotal: cartTotal,
          sc,
          pb1,
          rounding,
          grandTotal,
          customerInfo: { ...finalCustomerInfo }
        };
        setTransactions(prev => [newTransaction, ...prev]);

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
      }
    } catch (err: any) {
      console.error("Print error:", err);
      alert(err.message || "Gagal mencetak struk.");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPDF = async (tx?: Transaction) => {
    const isReprint = !!tx;
    if (isReprint) {
      setReprintTransaction(tx);
    }
    
    // We need a brief timeout to let the hidden receipt render if it's a reprint
    setTimeout(async () => {
      if (!receiptRef.current) return;
      setIsPrinting(true);
      try {
        const canvas = await html2canvas(receiptRef.current, {
          scale: 2,
          backgroundColor: "#ffffff",
        });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [80, 297]
        });
        
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        const fileName = isReprint ? tx.receiptNo : customerInfo.receiptNo;
        pdf.save(`${fileName}.pdf`);
        
        if (!isReprint) {
          const finalInfo = {
            ...customerInfo,
            name: customerInfo.name.trim() || "cust",
            phone: customerInfo.phone.trim() || "-"
          };
          
          const newTransaction: Transaction = {
            id: Date.now().toString(),
            receiptNo: finalInfo.receiptNo,
            timestamp: Date.now(),
            items: [...cart],
            subtotal: cartTotal,
            sc,
            pb1,
            rounding,
            grandTotal,
            customerInfo: { ...finalInfo }
          };
          setTransactions(prev => [newTransaction, ...prev]);

          setProducts(prev => prev.map(p => {
            const cartItem = cart.find(c => c.id === p.id);
            if (cartItem) {
              return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
            }
            return p;
          }));
          
          clearCart();
          setCustomerInfo(prev => ({ ...prev, receiptNo: generateReceiptNo() }));
        }
      } catch (err) {
        console.error("PDF error:", err);
        alert("Gagal mengunduh PDF.");
      } finally {
        setIsPrinting(false);
        if (isReprint) setReprintTransaction(null);
      }
    }, 100);
  };

  const handleBrowserPrint = (tx?: Transaction) => {
    const isReprint = !!tx;
    if (isReprint) {
      setReprintTransaction(tx);
      setTimeout(() => {
        window.print();
        setReprintTransaction(null);
      }, 100);
      return;
    }

    if ((cart?.length || 0) === 0) return;
    window.print();
    
    if (window.confirm("Apakah cetak berhasil? Klik OK untuk selesaikan transaksi.")) {
      const finalInfo = {
        ...customerInfo,
        name: customerInfo.name.trim() || "cust",
        phone: customerInfo.phone.trim() || "-"
      };
      
      const newTransaction: Transaction = {
        id: Date.now().toString(),
        receiptNo: finalInfo.receiptNo,
        timestamp: Date.now(),
        items: [...cart],
        subtotal: cartTotal,
        sc,
        pb1,
        rounding,
        grandTotal,
        customerInfo: { ...finalInfo }
      };
      setTransactions(prev => [newTransaction, ...prev]);

      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(c => c.id === p.id);
        if (cartItem) {
          return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
        }
        return p;
      }));
      clearCart();
      setCustomerInfo(prev => ({ ...prev, receiptNo: generateReceiptNo() }));
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

  const filteredProducts = (products || []).filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#E4E3E0] font-sans text-[#1a1a1a] selection:bg-[#5A5A40] selection:text-white">
      {/* Bottom Navigation Menu */}
      <div className="fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-4 w-full px-4 md:w-auto">
        <AnimatePresence>
          {isMenuOpen && (
            <motion.nav 
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-[24px] md:rounded-[32px] p-1.5 md:p-2 flex items-center gap-1 md:gap-2 max-w-full overflow-x-auto scrollbar-hide"
            >
              <button 
                onClick={() => { setView("sales"); setIsMenuOpen(false); }}
                className={cn(
                  "p-2.5 md:p-4 rounded-xl md:rounded-2xl transition-all duration-300 flex flex-col items-center gap-1 min-w-[64px] md:min-w-[80px]",
                  view === "sales" ? "bg-[#5A5A40] text-white shadow-lg" : "text-gray-400 hover:text-[#5A5A40] hover:bg-[#F5F5F0]"
                )}
              >
                <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
                <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-tighter">Kasir</span>
              </button>
              <button 
                onClick={() => { setView("products"); setIsMenuOpen(false); }}
                className={cn(
                  "p-2.5 md:p-4 rounded-xl md:rounded-2xl transition-all duration-300 flex flex-col items-center gap-1 min-w-[64px] md:min-w-[80px]",
                  view === "products" ? "bg-[#5A5A40] text-white shadow-lg" : "text-gray-400 hover:text-[#5A5A40] hover:bg-[#F5F5F0]"
                )}
              >
                <Package className="w-5 h-5 md:w-6 md:h-6" />
                <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-tighter">Produk</span>
              </button>
                <button 
                onClick={() => { setView("history"); setIsMenuOpen(false); }}
                className={cn(
                  "p-2.5 md:p-4 rounded-xl md:rounded-2xl transition-all duration-300 flex flex-col items-center gap-1 min-w-[64px] md:min-w-[80px]",
                  view === "history" ? "bg-[#5A5A40] text-white shadow-lg" : "text-gray-400 hover:text-[#5A5A40] hover:bg-[#F5F5F0]"
                )}
              >
                <Clock className="w-5 h-5 md:w-6 md:h-6" />
                <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-tighter">Histori</span>
              </button>
              <button 
                onClick={() => { setView("settings"); setIsMenuOpen(false); }}
                className={cn(
                  "p-2.5 md:p-4 rounded-xl md:rounded-2xl transition-all duration-300 flex flex-col items-center gap-1 min-w-[64px] md:min-w-[80px]",
                  view === "settings" ? "bg-[#5A5A40] text-white shadow-lg" : "text-gray-400 hover:text-[#5A5A40] hover:bg-[#F5F5F0]"
                )}
              >
                <SettingsIcon className="w-5 h-5 md:w-6 md:h-6" />
                <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-tighter">Setelan</span>
              </button>
              <div className="w-px h-6 md:h-8 bg-gray-100 mx-0.5 md:mx-1 flex-shrink-0" />
              <button 
                onClick={exportData}
                className="p-2.5 md:p-4 rounded-xl md:rounded-2xl text-gray-400 hover:text-[#5A5A40] hover:bg-[#F5F5F0] transition-all"
                title="Export Data"
              >
                <Download className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              <label className="p-2.5 md:p-4 rounded-xl md:rounded-2xl text-gray-400 hover:text-[#5A5A40] hover:bg-[#F5F5F0] cursor-pointer transition-all">
                <Upload className="w-5 h-5 md:w-6 md:h-6" />
                <input type="file" accept=".json" onChange={importData} className="hidden" />
              </label>
            </motion.nav>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={cn(
            "w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500",
            isMenuOpen ? "bg-white text-[#5A5A40] rotate-90" : "bg-[#5A5A40] text-white"
          )}
        >
          {isMenuOpen ? <X className="w-6 h-6 md:w-8 md:h-8" /> : <Menu className="w-6 h-6 md:w-8 md:h-8" />}
        </button>
      </div>

      {/* Main Content */}
      <main className="min-h-screen pb-32">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 px-4 md:px-8 py-4 md:py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-serif font-black tracking-tight text-[#1a1a1a]">
                {view === "sales" ? "Kasir" : view === "products" ? "Produk" : "Setelan"}
              </h1>
              <p className="hidden md:block text-[#5A5A40] text-[10px] font-medium uppercase tracking-widest mt-1">
                {settings.storeName} • {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            {view === "sales" && (
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative p-2.5 bg-[#F5F5F0] rounded-xl hover:bg-[#E4E3E0] transition-all md:hidden"
              >
                <ShoppingCart className="w-5 h-5 text-[#5A5A40]" />
                {(cart?.length || 0) > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                    {cart.reduce((s, i) => s + (i.quantity || 0), 0)}
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Bluetooth Indicator */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all",
              btDevice ? "bg-green-50 border-green-100 text-green-700" : "bg-[#F5F5F0] border-gray-100 text-gray-400"
            )}>
              <div className={cn("w-1.5 h-1.5 rounded-full", btDevice ? "bg-green-500 animate-pulse" : "bg-gray-300")} />
              <Printer className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                {btDevice ? (btDevice.name || "Printer Linked") : "No Printer"}
              </span>
            </div>

            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#5A5A40] transition-colors" />
              <input 
                type="text"
                placeholder="Cari..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full md:w-64 bg-[#F5F5F0] border-none rounded-2xl py-2.5 pl-11 pr-5 focus:ring-2 focus:ring-[#5A5A40] transition-all text-sm font-medium"
              />
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8">
          {view === "sales" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              {/* Product Grid */}
              <div className="lg:col-span-8">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                  {filteredProducts.map((product) => (
                    <ProductCard 
                      key={product.id}
                      product={product}
                      onAdd={addToCart}
                    />
                  ))}
                </div>
              </div>

              {/* Desktop Cart Sidebar */}
              <div className="hidden lg:block lg:col-span-4">
                <div className="bg-white rounded-[32px] p-6 sticky top-32 shadow-sm border border-gray-50 max-h-[calc(100vh-160px)] flex flex-col overflow-y-auto">
                  <CartContent 
                    cart={cart}
                    updateQuantity={updateQuantity}
                    setQuantity={setQuantity}
                    removeFromCart={removeFromCart}
                    customerInfo={customerInfo}
                    setCustomerInfo={setCustomerInfo}
                    cartTotal={cartTotal}
                    sc={sc}
                    pb1={pb1}
                    rounding={rounding}
                    grandTotal={grandTotal}
                    handlePrint={() => handlePrint()}
                    handleDownloadPDF={() => handleDownloadPDF()}
                    handleBrowserPrint={() => handleBrowserPrint()}
                    isPrinting={isPrinting}
                    pb1Rate={settings.pb1Rate}
                    btDevice={btDevice}
                  />
                </div>
              </div>
            </div>
          ) : view === "products" ? (
            <div className="bg-white rounded-[24px] md:rounded-[40px] p-5 md:p-10 shadow-sm border border-gray-50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-10">
                <div>
                  <h2 className="text-xl md:text-2xl font-serif font-black text-[#1a1a1a]">Manajemen Menu</h2>
                  <p className="text-gray-400 text-[10px] md:text-xs mt-1 uppercase tracking-wider font-bold">Total {products?.length || 0} Item</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingProduct(null);
                    setIsModalOpen(true);
                  }}
                  className="bg-[#5A5A40] text-white px-6 md:px-8 py-3.5 md:py-4 rounded-full font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-[#5A5A40]/20 text-sm md:text-base"
                >
                  <Plus className="w-5 h-5" />
                  Tambah Produk
                </button>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[#5A5A40] text-[10px] font-bold uppercase tracking-widest border-b border-gray-50">
                      <th className="pb-4 px-4">Produk</th>
                      <th className="pb-4">Kategori</th>
                      <th className="pb-4">Harga</th>
                      <th className="pb-4">Stok</th>
                      <th className="pb-4 text-right px-4">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="group hover:bg-[#F5F5F0]/50 transition-all">
                        <td className="py-4 px-4 font-bold text-[#1a1a1a]">{product.name}</td>
                        <td className="py-4 text-[#5A5A40] font-serif italic text-xs">{product.category}</td>
                        <td className="py-4 font-black text-xs">{formatCurrency(product.price)}</td>
                        <td className="py-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            product.stock > 10 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                          )}>
                            {product.stock}
                          </span>
                        </td>
                        <td className="py-4 text-right px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => {
                                setEditingProduct(product);
                                setIsModalOpen(true);
                              }}
                              className="p-3 text-[#5A5A40] hover:bg-white rounded-xl transition-all shadow-sm border border-gray-100"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-3 text-red-500 hover:bg-white rounded-xl transition-all shadow-sm border border-gray-100"
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

              {/* Mobile Card List */}
              <div className="md:hidden space-y-4">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="p-4 rounded-2xl bg-[#F5F5F0] border border-gray-100 flex items-center justify-between group">
                    <div>
                      <h4 className="font-bold text-sm text-[#1a1a1a]">{product.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400 font-serif italic">{product.category}</span>
                        <span className="w-1 h-1 bg-gray-300 rounded-full" />
                        <span className="text-[10px] font-black">{formatCurrency(product.price)}</span>
                      </div>
                      <div className={cn(
                        "inline-block mt-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide",
                        product.stock > 10 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      )}>
                        STOK: {product.stock}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setEditingProduct(product);
                          setIsModalOpen(true);
                        }}
                        className="p-4 text-[#5A5A40] bg-white rounded-2xl shadow-sm active:scale-95"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-4 text-red-500 bg-white rounded-2xl shadow-sm active:scale-95"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : view === "history" ? (
            <HistoryView 
              transactions={transactions} 
              onReprint={handlePrint}
              onDownloadPDF={handleDownloadPDF}
              onBrowserPrint={handleBrowserPrint}
            />
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white rounded-[24px] md:rounded-[40px] p-5 md:p-10 shadow-sm border border-gray-50">
                <div className="mb-6">
                  <h2 className="text-xl md:text-2xl font-serif font-black text-[#1a1a1a] flex items-center gap-3">
                    <Printer className="w-6 h-6 text-[#5A5A40]" />
                    Pencetakan Bluetooth
                  </h2>
                  <p className="text-gray-400 text-xs mt-1 italic">Web Bluetooth & BLE (Bluetooth Low Energy)</p>
                </div>

                <div className="p-5 md:p-6 bg-[#F5F5F0] rounded-[24px] md:rounded-[32px] border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <Monitor className="w-4 h-4 text-[#5A5A40]" />
                    </div>
                    <h4 className="font-bold text-sm text-[#1a1a1a]">Status Printer Bluetooth</h4>
                  </div>
                  
                  <div className="flex flex-col gap-3 mb-6">
                    <div className="text-[10px] text-gray-400 font-mono bg-white p-3 rounded-xl border border-gray-100 min-h-[40px] flex items-center justify-between">
                      <span>{btDevice ? `Terhubung: ${btDevice.name || "BT Printer"}` : "Belum ada printer terpilih"}</span>
                      {btDevice && (
                        <button 
                          onClick={() => setBtDevice(null)}
                          className="text-red-500 hover:bg-red-50 p-1 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed italic">
                      Browser hanya mendukung printer **BLE**. Jika printer Anda tidak muncul atau gagal, silakan gunakan **Browser Print (Ikon Monitor)** di kasir.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button 
                      onClick={async () => {
                        try {
                          const device = await requestPrinter();
                          setBtDevice(device);
                          device.addEventListener('gattserverdisconnected', () => {
                            setBtDevice(null);
                          });
                          alert(`Terhubung ke: ${device.name || "Bluetooth Printer"}\n\nSiap digunakan untuk mencetak struk.`);
                        } catch (err: any) {
                          if (err.message.includes("cancelled")) return;
                          alert(`Gagal terhubung: ${err.message}\n\nTips: Pastikan printer menyala, dalam mode Bluetooth (bukan kabel), dan tidak terhubung ke perangkat lain.`);
                        }
                      }}
                      className="w-full py-4 bg-white text-[#5A5A40] border border-[#5A5A40]/20 rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#5A5A40] hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      Cari & Hubungkan
                    </button>
                    
                    <button 
                      onClick={() => {
                        setBtDevice(null);
                        alert("Hubungan printer telah direset.");
                      }}
                      className="w-full py-4 bg-white text-gray-400 border border-gray-100 rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Reset Koneksi
                    </button>
                  </div>
                  
                  <div className="mt-4">
                    <button 
                      onClick={async () => {
                        try {
                          let device = btDevice;
                          if (!device) {
                            device = await requestPrinter();
                            setBtDevice(device);
                            device.addEventListener('gattserverdisconnected', () => {
                              setBtDevice(null);
                            });
                          }
                          setIsPrinting(true);
                          const escpos = new EscPos();
                          escpos.align("center").bold(true).line("TEST PRINT").bold(false).line("Berhasil Terkoneksi").feed(3);
                          await printToBluetooth(device, escpos.getBuffer());
                          alert("Test print terkirim!");
                        } catch (err: any) {
                          if (err.message.includes("cancelled")) return;
                          alert(`Error: ${err.message}`);
                        } finally {
                          setIsPrinting(false);
                        }
                      }}
                      disabled={isPrinting}
                      className="w-full py-4 bg-[#5A5A40] text-white rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isPrinting ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Printer className="w-4 h-4" />
                      )}
                      Cetak Test Page
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[24px] md:rounded-[40px] p-5 md:p-10 shadow-sm border border-gray-50">
                <div className="mb-8">
                  <h2 className="text-xl md:text-2xl font-serif font-black text-[#1a1a1a]">Setelan Toko</h2>
                  <p className="text-gray-400 text-xs mt-1 italic">Personalisasi aplikasi & data POS</p>
                </div>

              <form onSubmit={handleSaveSettings} className="space-y-6 md:space-y-8">
                <div className="space-y-4 md:space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Nama Usaha</label>
                    <input 
                      name="storeName"
                      defaultValue={settings.storeName}
                      required
                      className="w-full bg-[#F5F5F0] border-none rounded-xl md:rounded-2xl py-3.5 md:py-4 px-5 md:px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Alamat Lengkap</label>
                    <textarea 
                      name="storeAddress"
                      defaultValue={settings.storeAddress}
                      required
                      rows={3}
                      className="w-full bg-[#F5F5F0] border-none rounded-xl md:rounded-2xl py-3.5 md:py-4 px-5 md:px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all resize-none font-medium text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 md:gap-8">
                  <div>
                    <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Pajak PB1 (%)</label>
                    <div className="relative">
                      <input 
                        name="pb1Rate"
                        type="number"
                        defaultValue={settings.pb1Rate}
                        required
                        min="0"
                        max="100"
                        className="w-full bg-[#F5F5F0] border-none rounded-xl md:rounded-2xl py-3.5 md:py-4 px-5 md:px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold text-sm"
                      />
                      <span className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 font-black text-[#5A5A40] text-xs">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Svc Chg (%)</label>
                    <div className="relative">
                      <input 
                        name="scRate"
                        type="number"
                        defaultValue={settings.scRate}
                        required
                        min="0"
                        max="100"
                        className="w-full bg-[#F5F5F0] border-none rounded-xl md:rounded-2xl py-3.5 md:py-4 px-5 md:px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold text-sm"
                      />
                      <span className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 font-black text-[#5A5A40] text-xs">%</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Visualisasi Logo</label>
                    <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 p-4 md:p-6 bg-[#F5F5F0] rounded-2xl md:rounded-3xl border-2 border-dashed border-gray-200">
                      {settings.logoUrl ? (
                        <div className="relative group flex-shrink-0">
                          <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-xl md:rounded-2xl flex items-center justify-center overflow-hidden shadow-sm">
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
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-xl md:rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-200 flex-shrink-0">
                          <SettingsIcon className="w-6 h-6 md:w-8 md:h-8 text-gray-200" />
                        </div>
                      )}
                      <div className="flex-1 w-full sm:w-auto">
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="w-full text-[10px] text-gray-400 file:mr-3 md:file:mr-4 file:py-2 md:file:py-2.5 file:px-4 md:file:px-6 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-[#5A5A40] file:text-white hover:file:opacity-90 cursor-pointer"
                        />
                        <p className="text-[9px] text-gray-400 mt-2 italic">Format PNG/JPG, saran latar belakang transparan.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-[#5A5A40] text-white rounded-full py-4 md:py-5 font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl shadow-[#5A5A40]/20 text-sm md:text-base"
                >
                  <Save className="w-5 h-5" />
                  Simpan Setelan
                </button>
              </form>
            </div>
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
              className="absolute right-0 top-0 bottom-0 w-full md:max-w-md bg-white p-5 md:p-8 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <div>
                  <h2 className="text-xl font-serif font-black">Checkout</h2>
                  <p className="text-[#5A5A40] text-[10px] font-bold uppercase tracking-widest mt-1">Selesaikan Transaksi</p>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-2.5 bg-[#F5F5F0] rounded-full hover:bg-gray-100 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto min-h-0">
                <CartContent 
                  cart={cart}
                  updateQuantity={updateQuantity}
                  setQuantity={setQuantity}
                  removeFromCart={removeFromCart}
                  customerInfo={customerInfo}
                  setCustomerInfo={setCustomerInfo}
                  cartTotal={cartTotal}
                  sc={sc}
                  pb1={pb1}
                  rounding={rounding}
                  grandTotal={grandTotal}
                  handlePrint={() => handlePrint()}
                  handleDownloadPDF={() => handleDownloadPDF()}
                  handleBrowserPrint={() => handleBrowserPrint()}
                  isPrinting={isPrinting}
                  pb1Rate={settings.pb1Rate}
                  btDevice={btDevice}
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <h3 className="text-xl md:text-2xl font-serif font-black text-[#1a1a1a]">
                  {editingProduct ? "Edit Item" : "Menu Baru"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-[#F5F5F0] rounded-full sm:hidden">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSaveProduct} className="space-y-4 md:space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Nama Identitas</label>
                  <input 
                    name="name"
                    defaultValue={editingProduct?.name}
                    required
                    className="w-full bg-[#F5F5F0] border-none rounded-xl md:rounded-2xl py-3.5 md:py-4 px-5 md:px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold text-sm"
                    placeholder="Contoh: Espresso"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Harga Jual</label>
                    <input 
                      name="price"
                      type="number"
                      defaultValue={editingProduct?.price}
                      required
                      className="w-full bg-[#F5F5F0] border-none rounded-xl md:rounded-2xl py-3.5 md:py-4 px-5 md:px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Persediaan</label>
                    <input 
                      name="stock"
                      type="number"
                      defaultValue={editingProduct?.stock}
                      required
                      className="w-full bg-[#F5F5F0] border-none rounded-xl md:rounded-2xl py-3.5 md:py-4 px-5 md:px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Grup Kategori</label>
                  <select 
                    name="category"
                    defaultValue={editingProduct?.category}
                    className="w-full bg-[#F5F5F0] border-none rounded-xl md:rounded-2xl py-3.5 md:py-4 px-5 md:px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all appearance-none font-bold text-sm cursor-pointer"
                  >
                    <option value="Makanan">Makanan</option>
                    <option value="Minuman">Minuman</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-4 md:pt-6">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="order-2 sm:order-1 flex-1 bg-gray-50 text-gray-400 rounded-full py-3.5 md:py-4 font-bold hover:bg-gray-100 transition-all text-sm"
                  >
                    Tutup
                  </button>
                  <button 
                    type="submit"
                    className="order-1 sm:order-2 flex-[2] bg-[#5A5A40] text-white rounded-full py-3.5 md:py-4 px-8 md:px-10 font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-[#5A5A40]/20 text-sm"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Receipt for PDF/Print Rendering */}
      <div className="fixed -left-[2000px] top-0 p-8 bg-white" ref={receiptRef}>
        <div style={{ width: '380px' }} className="text-[#1a1a1a] font-mono text-xs leading-relaxed p-4 border border-gray-100 shadow-sm">
          <div className="text-center mb-6">
            {settings.logoUrl && <img src={settings.logoUrl} className="w-16 h-16 mx-auto mb-2 object-contain" referrerPolicy="no-referrer" />}
            <h2 className="text-lg font-black uppercase tracking-tighter">{settings.storeName}</h2>
            <p className="text-[10px] opacity-70 whitespace-pre-wrap">{settings.storeAddress}</p>
          </div>
          
          <div className="border-t border-dashed border-gray-400 my-4" />
          
          {reprintTransaction && (
            <div className="text-center font-black mb-4 bg-gray-100 py-1 rounded">*** REPRINT STRUK ***</div>
          )}

          <div className="space-y-1.5 mb-6 text-[10px]">
            <div className="flex justify-between">
              <span className="opacity-60 uppercase font-bold tracking-widest text-[8px]">No. Struk</span>
              <span className="font-black">{reprintTransaction?.receiptNo || customerInfo.receiptNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-60 uppercase font-bold tracking-widest text-[8px]">Waktu</span>
              <span>{new Date(reprintTransaction?.timestamp || Date.now()).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-60 uppercase font-bold tracking-widest text-[8px]">Pelanggan</span>
              <span className="font-bold">{(reprintTransaction?.customerInfo?.name || customerInfo.name) || "Guest"}</span>
            </div>
          </div>
          
          <div className="border-t-2 border-dashed border-gray-200 my-4" />
          
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-[8px] font-black opacity-40 uppercase tracking-widest mb-1">
              <span>Item Description</span>
              <span>Subtotal</span>
            </div>
            {(reprintTransaction?.items || cart || []).map(item => (
              <div key={item.id} className="group">
                <div className="flex justify-between font-black text-[11px]">
                  <span className="flex-1 pr-4 leading-tight">{item.name}</span>
                  <span className="text-right">{formatCurrency(item.price * item.quantity)}</span>
                </div>
                <div className="flex justify-between text-[9px] opacity-60">
                  <span>{item.quantity} x {formatCurrency(item.price)}</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="border-t-2 border-dashed border-gray-200 my-4" />
          
          <div className="space-y-2 mb-8">
            <div className="flex justify-between text-[11px]">
              <span className="opacity-60">Subtotal</span>
              <span className="font-bold">{formatCurrency(reprintTransaction?.subtotal || cartTotal)}</span>
            </div>
            {(reprintTransaction ? reprintTransaction.sc > 0 : sc > 0) && (
              <div className="flex justify-between text-[11px]">
                <span className="opacity-60">Svc Charge</span>
                <span>{formatCurrency(reprintTransaction?.sc || sc)}</span>
              </div>
            )}
            <div className="flex justify-between text-[11px]">
              <span className="opacity-60">PB1 ({settings.pb1Rate}%)</span>
              <span>{formatCurrency(reprintTransaction?.pb1 || pb1)}</span>
            </div>
            {(reprintTransaction?.rounding || rounding) !== 0 && (
              <div className="flex justify-between text-[11px]">
                <span className="opacity-60 italic">Pembulatan</span>
                <span className="italic">{formatCurrency(reprintTransaction?.rounding || rounding)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black pt-3 border-t border-gray-100 mt-3">
              <span className="tracking-tighter">TOTAL</span>
              <span className="text-[#1a1a1a]">{formatCurrency(reprintTransaction?.grandTotal || grandTotal)}</span>
            </div>
          </div>
          
          <div className="text-center space-y-1 mt-10">
            <p className="text-[10px] font-black uppercase tracking-widest">Terima Kasih</p>
            <p className="text-[8px] opacity-60 italic">Selamat Datang Kembali</p>
          </div>
        </div>
      </div>

      {/* Global Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #printable-receipt, #printable-receipt * { visibility: visible; }
          #printable-receipt { 
            position: fixed; 
            left: 0;
            top: 0;
            width: 80mm;
            padding: 5mm;
            margin: 0;
            background: white;
            font-family: 'Courier New', Courier, monospace;
            color: black;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}} />
      <div id="printable-receipt" className="hidden print:block font-mono bg-white text-black text-xs leading-relaxed">
        <div className="text-center mb-4">
          <h2 className="text-sm font-black uppercase tracking-tight">{settings.storeName}</h2>
          <p className="text-[10px] leading-tight whitespace-pre-wrap">{settings.storeAddress}</p>
        </div>
        
        <div className="border-t border-dashed border-black my-3" />
        
        {reprintTransaction && <div className="text-center font-bold mb-2">*** REPRINT STRUK ***</div>}

        <div className="space-y-1 mb-3 text-[10px]">
          <div className="flex justify-between">
            <span>No: {reprintTransaction?.receiptNo || customerInfo.receiptNo}</span>
            <span>{new Date(reprintTransaction?.timestamp || Date.now()).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
          <div className="flex justify-between">
            <span>Pelanggan: {reprintTransaction?.customerInfo?.name || customerInfo.name || "Guest"}</span>
          </div>
        </div>
        
        <div className="border-t border-dashed border-black my-3" />
        
        <div className="space-y-2 mb-3">
          {(reprintTransaction?.items || cart || []).map(item => (
            <div key={item.id}>
              <div className="flex justify-between font-bold">
                <span className="flex-1 pr-2 leading-tight">{item.name}</span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>{item.quantity} x {formatCurrency(item.price)}</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="border-t border-dashed border-black my-3" />
        
        <div className="space-y-1 mb-6">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(reprintTransaction?.subtotal || cartTotal)}</span>
          </div>
          {(reprintTransaction ? reprintTransaction.sc > 0 : sc > 0) && (
            <div className="flex justify-between">
              <span>Svc Charge</span>
              <span>{formatCurrency(reprintTransaction?.sc || sc)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>PB1 ({settings.pb1Rate}%)</span>
            <span>{formatCurrency(reprintTransaction?.pb1 || pb1)}</span>
          </div>
          {(reprintTransaction?.rounding || rounding) !== 0 && (
            <div className="flex justify-between italic">
              <span>Rounding</span>
              <span>{formatCurrency(reprintTransaction?.rounding || rounding)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-black mt-2">
            <span>TOTAL</span>
            <span>{formatCurrency(reprintTransaction?.grandTotal || grandTotal)}</span>
          </div>
        </div>
        
        <div className="text-center space-y-1 mt-8 pb-10">
          <p className="text-[10px] font-bold">TERIMA KASIH</p>
          <p className="text-[8px] italic">Selamat Datang Kembali</p>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ transactions, onReprint, onDownloadPDF, onBrowserPrint }: { 
  transactions: Transaction[], 
  onReprint: (tx: Transaction) => void,
  onDownloadPDF: (tx: Transaction) => void,
  onBrowserPrint: (tx: Transaction) => void 
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[24px] md:rounded-[40px] p-6 md:p-10 shadow-sm border border-gray-50">
        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-serif font-black text-[#1a1a1a]">Histori Transaksi</h2>
          <p className="text-gray-400 text-xs mt-1 italic">Daftar penjualan yang telah selesai</p>
        </div>

        {(transactions?.length || 0) === 0 ? (
          <div className="text-center py-20 bg-[#F5F5F0] rounded-[32px]">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-400 font-serif italic">Belum ada transaksi</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(transactions || []).map(tx => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={tx.id}
                className="bg-[#F5F5F0] rounded-[24px] p-5 md:p-6 group hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-gray-100"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[10px] font-black text-[#5A5A40] uppercase tracking-widest">{tx.receiptNo}</span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full" />
                      <span className="text-[10px] text-gray-400 font-medium">
                        {new Date(tx.timestamp || 0).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <h4 className="font-bold text-[#1a1a1a] text-lg">{tx.customerInfo?.name || "Walk-in Customer"}</h4>
                      <span className="text-gray-300 text-xs italic">({tx.items?.length || 0} item)</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(tx.items || []).slice(0, 3).map(item => (
                        <span key={item.id} className="bg-white px-3 py-1 rounded-full text-[10px] font-bold text-[#5A5A40]">
                          {item.quantity}x {item.name}
                        </span>
                      ))}
                      {(tx.items?.length || 0) > 3 && (
                        <span className="text-[10px] text-gray-400 font-medium pl-1">+{(tx.items?.length || 0) - 3} lainnya</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Bayar</p>
                      <p className="text-xl font-black text-[#5A5A40]">{formatCurrency(tx.grandTotal)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => onReprint(tx)}
                        className="p-3 bg-white text-[#5A5A40] rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 border border-transparent hover:border-[#5A5A40]/10"
                        title="Reprint Bluetooth"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => onDownloadPDF(tx)}
                        className="p-3 bg-white text-[#5A5A40] rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 border border-transparent hover:border-[#5A5A40]/10"
                        title="Reprint PDF"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => onBrowserPrint(tx)}
                        className="p-3 bg-white text-[#5A5A40] rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 border border-transparent hover:border-[#5A5A40]/10"
                        title="Browser Print"
                      >
                        <Monitor className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CartContent({ 
  cart, 
  updateQuantity, 
  setQuantity,
  removeFromCart, 
  customerInfo, 
  setCustomerInfo,
  cartTotal,
  sc,
  pb1,
  rounding,
  grandTotal,
  handlePrint,
  handleDownloadPDF,
  handleBrowserPrint,
  isPrinting,
  pb1Rate,
  btDevice
}: any) {
  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold text-[#5A5A40] mb-1.5 md:mb-2 uppercase tracking-widest">No. Faktur</label>
          <input 
            type="text" 
            placeholder="No. Struk" 
            value={customerInfo.receiptNo}
            onChange={(e) => setCustomerInfo({ ...customerInfo, receiptNo: e.target.value })}
            className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-5 text-xs font-bold focus:ring-2 focus:ring-[#5A5A40] transition-all"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#5A5A40] mb-1.5 md:mb-2 uppercase tracking-widest">Konsumen</label>
          <input 
            type="text" 
            placeholder="Nama" 
            value={customerInfo.name}
            onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
            className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-5 text-xs font-bold focus:ring-2 focus:ring-[#5A5A40] transition-all"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#5A5A40] mb-1.5 md:mb-2 uppercase tracking-widest">HP/WA</label>
          <input 
            type="text" 
            placeholder="Telepon" 
            value={customerInfo.phone}
            onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
            className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-5 text-xs font-bold focus:ring-2 focus:ring-[#5A5A40] transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 md:pr-2 space-y-4 md:space-y-5 mb-6 md:mb-8 min-h-0">
        <AnimatePresence mode="popLayout">
          {(cart?.length || 0) === 0 ? (
            <div className="text-center py-8 md:py-12">
              <div className="w-16 h-16 bg-[#F5F5F0] rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-8 h-8 text-gray-200" />
              </div>
              <p className="text-gray-300 font-serif italic text-sm">Keranjang masih kosong</p>
            </div>
          ) : (
            (cart || []).map((item: any) => (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={item.id} 
                className="flex items-center gap-3 md:gap-4 group p-2 rounded-2xl hover:bg-[#F5F5F0]/50 transition-all border border-transparent hover:border-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[#1a1a1a] text-xs md:text-sm truncate">{item.name}</h4>
                  <p className="text-[10px] text-[#5A5A40] font-serif italic">{formatCurrency(item.price)}</p>
                </div>
                <div className="flex items-center gap-2 md:gap-3 bg-[#F5F5F0] rounded-full px-2 md:px-3 py-1 md:py-1.5">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-[#5A5A40] hover:text-black transition-colors rounded-full hover:bg-white shadow-sm">
                    <Minus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                  </button>
                  <input 
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 1)}
                    className="bg-transparent border-none p-0 w-8 md:w-10 text-center font-black text-[10px] md:text-xs focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-[#5A5A40] hover:text-black transition-colors rounded-full hover:bg-white shadow-sm">
                    <Plus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                  </button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded-xl active:scale-90">
                  <X className="w-5 h-5" />
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <div className="pt-6 md:pt-8 border-t border-gray-100 space-y-2 md:space-y-3">
        <div className="flex justify-between text-[10px] md:text-xs text-gray-400 font-medium">
          <span className="uppercase tracking-widest">Subtotal</span>
          <span className="font-bold">{formatCurrency(cartTotal)}</span>
        </div>
        {sc > 0 && (
          <div className="flex justify-between text-[10px] md:text-xs text-gray-400 font-medium">
            <span className="uppercase tracking-widest">Service Charge</span>
            <span className="font-bold">{formatCurrency(sc)}</span>
          </div>
        )}
        <div className="flex justify-between text-[10px] md:text-xs text-gray-400 font-medium">
          <span className="uppercase tracking-widest">PB1 ({pb1Rate}%)</span>
          <span className="font-bold">{formatCurrency(pb1)}</span>
        </div>
        {rounding !== 0 && (
          <div className="flex justify-between text-[10px] md:text-xs text-[#5A5A40] font-medium">
            <span className="uppercase tracking-widest">Pembulatan</span>
            <span className="font-bold">{formatCurrency(rounding)}</span>
          </div>
        )}
        <div className="flex justify-between text-base md:text-lg font-black text-[#1a1a1a] pt-2 border-t border-dashed border-gray-100 mt-2">
          <span className="uppercase tracking-tighter">Total Bayar</span>
          <span className="text-[#5A5A40]">{formatCurrency(grandTotal)}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-6 md:pt-8">
          <button 
            onClick={handlePrint}
            disabled={(cart?.length || 0) === 0 || isPrinting}
            className="col-span-2 bg-[#5A5A40] text-white rounded-2xl md:rounded-3xl py-5 md:py-6 font-black uppercase tracking-[0.2em] hover:opacity-90 transition-all flex flex-col items-center justify-center gap-1 shadow-xl shadow-[#5A5A40]/20 disabled:opacity-50 disabled:shadow-none active:scale-95 group"
          >
            <div className="flex items-center gap-3">
              {isPrinting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Printer className="w-6 h-6 group-hover:scale-110 transition-transform" />
              )}
              <span className="text-base md:text-lg">
                {isPrinting ? (
                  btDevice ? "Sedang Mencetak..." : "Cari Printer..."
                ) : (
                  btDevice ? "Bayar & Cetak" : "Pilih Printer & Bayar"
                )}
              </span>
            </div>
            <span className="text-[9px] opacity-60 font-bold">Bluetooth Thermal Printer</span>
          </button>

          <div className="col-span-2 grid grid-cols-2 gap-3 mt-1">
            <button 
              onClick={handleBrowserPrint}
              disabled={(cart?.length || 0) === 0 || isPrinting}
              className="bg-white border-2 border-[#5A5A40]/10 text-[#5A5A40] rounded-xl md:rounded-2xl py-3 md:py-4 font-bold uppercase tracking-widest hover:bg-[#F5F5F0] transition-all flex items-center justify-center gap-2 text-[10px] md:text-xs disabled:opacity-50 active:scale-95"
            >
              <Monitor className="w-4 h-4" />
              Browser Print
            </button>
            <button 
              onClick={handleDownloadPDF}
              disabled={(cart?.length || 0) === 0 || isPrinting}
              className="bg-white border-2 border-[#5A5A40]/10 text-[#5A5A40] rounded-xl md:rounded-2xl py-3 md:py-4 font-bold uppercase tracking-widest hover:bg-[#F5F5F0] transition-all flex items-center justify-center gap-2 text-[10px] md:text-xs disabled:opacity-50 active:scale-95"
            >
              <Download className="w-4 h-4" />
              Simpan PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
