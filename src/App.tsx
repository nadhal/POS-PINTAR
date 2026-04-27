import React, { useState, useEffect, useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
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
  ChevronLeft,
  CreditCard,
  QrCode,
  Wallet,
  TrendingUp,
  DollarSign,
  Briefcase,
  Users,
  Percent,
  Star,
  CheckCircle,
  RefreshCw
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

// Global UI Utilities
const playBeep = (type: 'success' | 'click' | 'error' = 'click') => {
  try {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    if (type === 'success') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.1, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
    } else if (type === 'error') {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(110, context.currentTime);
      gainNode.gain.setValueAtTime(0.1, context.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.3);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.3);
    } else {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, context.currentTime);
      gainNode.gain.setValueAtTime(0.05, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.05);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.05);
    }

    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch (e) {
    // Silent fail if audio context is blocked or not supported
  }
};

interface CartItem extends Product {
  quantity: number;
}

interface Settings {
  pb1Rate: number;
  scRate: number;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  logoUrl: string;
  receiptFooter?: string;
  receiptHeader?: string;
  adminPin: string;
  securityQuestion?: string;
  securityAnswer?: string;
}

interface CustomerInfo {
  name: string;
  phone: string;
  receiptNo: string;
  paymentMethod: "Tunai" | "QRIS";
  customDate?: string;
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
  discount: number;
  grandTotal: number;
  customerInfo: CustomerInfo;
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
interface ProductCardProps {
  key?: React.Key;
  product: Product;
  onAdd: (p: Product, q?: number) => void;
  onUpdateQty?: (id: string, delta: number) => void;
  cartQty?: number;
}

const ProductCard = ({ 
  product, 
  onAdd, 
  onUpdateQty,
  cartQty = 0 
}: ProductCardProps) => {
  const [qty, setQty] = useState(1);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "group bg-white rounded-2xl md:rounded-[32px] p-4 md:p-6 hover:shadow-xl hover:shadow-[#5A5A40]/5 transition-all duration-300 border flex flex-col h-full relative overflow-hidden",
        cartQty > 0 ? "border-[#5A5A40]/30 shadow-lg shadow-[#5A5A40]/5" : "border-transparent hover:border-[#F5F5F0]"
      )}
    >
      {cartQty > 0 && (
        <div className="absolute top-0 right-0 bg-[#5A5A40] text-white text-[10px] font-black px-3 py-1 rounded-bl-xl shadow-md z-10">
          {cartQty}x DI KERANJANG
        </div>
      )}

      <div className="flex-1">
        <h3 className="font-bold text-[#1a1a1a] text-sm md:text-base mb-0.5 line-clamp-1 group-hover:text-[#5A5A40] transition-colors">{product.name}</h3>
        <p className="text-gray-400 font-serif italic text-[10px] md:text-xs mb-3">{product.category}</p>
        <span className="font-black text-xs md:text-sm">{formatCurrency(product.price)}</span>
      </div>
      
      <div className="mt-4 flex flex-col gap-2">
        {cartQty > 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex bg-[#5A5A40] rounded-xl overflow-hidden shadow-lg flex-1">
              <button 
                onClick={() => onUpdateQty?.(product.id, -1)}
                className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/10 transition-colors"
                title="Kurangi"
              >
                <Minus className="w-3 h-3" />
              </button>
              <div className="flex-1 h-10 flex items-center justify-center font-black text-sm text-white select-none">
                {cartQty}
              </div>
              <button 
                onClick={() => onUpdateQty?.(product.id, 1)}
                className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/10 transition-colors"
                title="Tambah"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <button 
              onClick={() => onAdd(product, 1)}
              className="w-10 h-10 bg-[#F5F5F0] rounded-xl flex items-center justify-center text-[#5A5A40] hover:bg-[#5A5A40] hover:text-white transition-all shadow-sm"
              title="Tambah Lagi"
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex bg-[#F5F5F0] rounded-lg px-2 py-1 flex-1 border border-gray-100 shadow-inner">
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
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#F5F5F0] text-[#5A5A40] hover:bg-[#5A5A40] hover:text-white transition-all duration-300 active:scale-90 shadow-sm"
              title="Tambah ke Keranjang"
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      
      {/* Visual indicator for 0 quantity if requested explicitly */}
      {cartQty === 0 && (
        <div className="mt-2 text-[8px] font-bold text-gray-300 uppercase tracking-widest text-center">
          Belum terpilih (0)
        </div>
      )}
    </motion.div>
  );
};

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => getLocal(STORAGE_KEYS.PRODUCTS, []));
  const [transactions, setTransactions] = useState<Transaction[]>(() => getLocal(STORAGE_KEYS.TRANSACTIONS, []));

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };
  const [cart, setCart] = useState<CartItem[]>([]);
  const [view, setView] = useState<"sales" | "products" | "settings" | "history" | "dashboard">("sales");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [viewToAuth, setViewToAuth] = useState<"products" | "settings" | "history" | "dashboard" | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [isPrinting, setIsPrinting] = useState(false);
  const [btDevice, setBtDevice] = useState<any>(null);
  const [settingsBtError, setSettingsBtError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(() => {
    const defaults = {
      pb1Rate: 10,
      scRate: 0,
      storeName: "POS PINTAR",
      storeAddress: "Jl. Contoh No. 123",
      storePhone: "0812-XXXX-XXXX",
      logoUrl: "",
      receiptFooter: "Terima Kasih Atas Kunjungan Anda",
      receiptHeader: "",
      adminPin: "1234",
      securityQuestion: "Nama hewan peliharaan pertama?",
      securityAnswer: "kucing"
    };
    const saved = getLocal(STORAGE_KEYS.SETTINGS, defaults);
    return { ...defaults, ...saved };
  });

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isForgotPinOpen, setIsForgotPinOpen] = useState(false);
  const [forgotAnswer, setForgotAnswer] = useState("");
  const [forgotError, setForgotError] = useState(false);

  // Navigation Protection
  const handleViewChange = (newView: typeof view) => {
    if (newView === "sales" || isAuthenticated) {
      setView(newView);
      setIsMenuOpen(false);
    } else {
      setViewToAuth(newView as any);
      setPinInput("");
      setPinError(false);
      setFailedAttempts(0);
    }
  };

  const handlePinSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (pinInput === settings.adminPin) {
      setIsAuthenticated(true);
      if (viewToAuth) {
        setView(viewToAuth);
        setViewToAuth(null);
      }
      setIsMenuOpen(false);
      setPinInput("");
      setPinError(false);
      setFailedAttempts(0);
    } else {
      setPinError(true);
      setPinInput("");
      setFailedAttempts(prev => prev + 1);
      // Vibration feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }
    }
  };

  const handleResetPin = () => {
    setIsForgotPinOpen(true);
    setPinError(false);
  };

  const handleForgotPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotAnswer.toLowerCase().trim() === (settings.securityAnswer || "").toLowerCase().trim()) {
      setIsAuthenticated(true);
      if (viewToAuth) {
        setView(viewToAuth);
        setViewToAuth(null);
      }
      setIsMenuOpen(false);
      setPinInput("");
      setPinError(false);
      setFailedAttempts(0);
      setIsForgotPinOpen(false);
      setForgotAnswer("");
      setForgotError(false);
      alert("Akses diberikan. Jangan lupa ganti PIN di pengaturan!");
    } else {
      setForgotError(true);
      if ('vibrate' in navigator) navigator.vibrate(200);
    }
  };

  // Auto-lock when switching to sales
  useEffect(() => {
    if (view === "sales") {
      // Small delay to ensure they can switch back if it was a mistake? 
      // No, let's keep it authenticated for the session until they manually lock or refresh.
      // Or we can auto-lock when they stay in sales for more than X minutes.
    }
  }, [view]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setView("sales");
  };
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
        { id: "1", name: "THAI TEA", price: 10000, stock: 50, category: "Minuman", createdAt: Date.now() }
      ];
      setProducts(demoProducts);
    }
  }, []);

  // Cart Logic
  const addToCart = (product: Product, quantity: number = 1) => {
    playBeep('click');
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
    setCart(prev => {
      return prev.map(item => {
        if (item.id === productId) {
          playBeep('click');
          return { ...item, quantity: item.quantity + delta };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const setQuantity = (productId: string, quantity: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, quantity: Math.max(1, quantity) };
      }
      return item;
    }));
  };

  const clearCart = () => {
    setCart([]);
    setCartDiscount(0);
  };

  const generateReceiptNo = (customDate?: string) => {
    const now = customDate ? new Date(customDate) : new Date();
    const dateStr = now.getFullYear().toString().slice(-2) + 
                    (now.getMonth() + 1).toString().padStart(2, '0') + 
                    now.getDate().toString().padStart(2, '0');
    const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
    return `TRX-${dateStr}-${randomStr}`;
  };

  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    receiptNo: generateReceiptNo(),
    paymentMethod: "Tunai" as "Tunai" | "QRIS",
    customDate: new Date().toISOString().split('T')[0]
  });

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
  const discountAmount = useMemo(() => {
    if (cartDiscount <= 0) return 0;
    return cartDiscount;
  }, [cartDiscount]);

  const subtotalAfterDiscount = Math.max(0, cartTotal - discountAmount);
  const sc = Math.round(subtotalAfterDiscount * (settings.scRate / 100));
  const pb1 = Math.round(subtotalAfterDiscount * (settings.pb1Rate / 100));
  const rawGrandTotal = subtotalAfterDiscount + sc + pb1;
  const grandTotal = Math.ceil(rawGrandTotal / 1000) * 1000;
  const rounding = grandTotal - rawGrandTotal;

  const completeTransaction = (info = customerInfo) => {
    const finalInfo = {
      ...info,
      name: info.name.trim() || "Walk-in",
      phone: info.phone.trim() || "-"
    };

    const now = new Date();
    const transactionTimestamp = info.customDate 
      ? new Date(`${info.customDate}T${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`).getTime() || Date.now()
      : Date.now();

    const newTransaction: Transaction = {
      id: transactionTimestamp.toString() + Math.random().toString(36).substr(2, 5),
      receiptNo: finalInfo.receiptNo,
      timestamp: transactionTimestamp,
      items: [...cart],
      subtotal: cartTotal,
      sc,
      pb1,
      rounding,
      discount: discountAmount,
      grandTotal,
      customerInfo: { ...finalInfo }
    };

    setTransactions(prev => [newTransaction, ...prev]);
    playBeep('success');

    // Update stock locally
    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(c => c.id === p.id);
      if (cartItem) {
        return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
      }
      return p;
    }));

    clearCart();
    setCustomerInfo({
      ...finalInfo,
      name: "",
      phone: "",
      receiptNo: generateReceiptNo(),
      customDate: new Date().toISOString().split('T')[0]
    });
  };

  const receiptRef = useRef<HTMLDivElement>(null);
  const [reprintTransaction, setReprintTransaction] = useState<Transaction | null>(null);
  const [btError, setBtError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'f':
        case '/':
          e.preventDefault();
          searchInputRef.current?.focus();
          break;
        case 'enter':
          if (cart.length > 0 && view === 'sales') {
            e.preventDefault();
            if (!isCartOpen) {
              setIsCartOpen(true);
              playBeep('click');
            } else if (!isPrinting) {
              handlePrint();
            }
          }
          break;
        case 'escape':
          if (isCartOpen) setIsCartOpen(false);
          if (isMenuOpen) setIsMenuOpen(false);
          if (isModalOpen) setIsModalOpen(false);
          if (reprintTransaction) setReprintTransaction(null);
          break;
        case 'd':
          handleViewChange('dashboard');
          break;
        case 's':
          handleViewChange('sales');
          break;
        case 'p':
          handleViewChange('products');
          break;
        case 'h':
          handleViewChange('history');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, isCartOpen, isMenuOpen, isModalOpen, cart.length, reprintTransaction]);

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
    const txDiscount = isReprint ? tx?.discount : discountAmount;
    const txGrandTotal = isReprint ? tx?.grandTotal : grandTotal;

    if ((items?.length || 0) === 0) return;
    setBtError(null);
    
    let device = btDevice;
    if (!device) {
      try {
        device = await requestPrinter();
        setBtDevice(device);
        device.addEventListener('gattserverdisconnected', () => {
          setBtDevice(null);
        });
      } catch (pickErr: any) {
        if (!pickErr.message.includes("Dibatalkan")) {
          setBtError(pickErr.message);
        }
        return;
      }
    }

    setIsPrinting(true);
    let printSuccess = false;
    let finalCustomerInfo = {
      name: (info?.name || "").trim() || "cust",
      phone: (info?.phone || "").trim() || "-",
      receiptNo: info?.receiptNo || customerInfo.receiptNo,
      paymentMethod: info?.paymentMethod || customerInfo.paymentMethod
    };

    try {

      console.log("Connecting to printer...");
      
      const escpos = new EscPos();
      await escpos.receiptHeader(settings.storeName, settings.storeAddress, settings.storePhone, settings.logoUrl);
      const txNow = new Date();
      const transactionTimestamp = info?.customDate 
        ? new Date(`${info.customDate}T${txNow.getHours().toString().padStart(2, '0')}:${txNow.getMinutes().toString().padStart(2, '0')}:${txNow.getSeconds().toString().padStart(2, '0')}`).getTime() || Date.now()
        : Date.now();

      escpos.receiptOrderInfo({
        name: finalCustomerInfo.name,
        phone: finalCustomerInfo.phone,
        receiptNo: finalCustomerInfo.receiptNo,
        timestamp: isReprint ? tx?.timestamp : transactionTimestamp
      });
      if (isReprint) {
        escpos.align("center").bold(true).line("REPRINT STRUK").bold(false).align("left");
      }
      escpos.receiptItemHeader();
      items.forEach(item => {
        escpos.receiptItem(item.name, item.quantity, item.price);
      });
      escpos.receiptFooter({
        totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
        total: txTotal,
        sc: txSc,
        pb1: txPb1,
        rounding: txRounding,
        discount: txDiscount,
        grandTotal: txGrandTotal,
        paymentMethod: finalCustomerInfo.paymentMethod
      }, settings.receiptFooter);

      const buffer = escpos.getBuffer();
      await printToBluetooth(device, buffer);
      printSuccess = true;

    } catch (err: any) {
      console.error("Print error:", err);
      alert(err.message || "Gagal mencetak struk.");
    } finally {
      setIsPrinting(false);
      
      if (!isReprint) {
        if (printSuccess) {
          completeTransaction(finalCustomerInfo);
          setIsCartOpen(false);
        } else if (window.confirm("Pencetakan gagal. Tetap selesaikan transaksi ini?")) {
          completeTransaction(finalCustomerInfo);
          setIsCartOpen(false);
        }
      }
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
          completeTransaction();
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
      completeTransaction();
      setIsCartOpen(false);
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
      storePhone: formData.get("storePhone") as string,
      pb1Rate: Number(formData.get("pb1Rate")),
      scRate: Number(formData.get("scRate")),
      logoUrl: settings.logoUrl,
      receiptFooter: formData.get("receiptFooter") as string,
      receiptHeader: formData.get("receiptHeader") as string,
      adminPin: formData.get("adminPin") as string,
      securityQuestion: formData.get("securityQuestion") as string,
      securityAnswer: formData.get("securityAnswer") as string,
    };
    setSettings(newSettings);
    alert("Pengaturan berhasil disimpan secara lokal!");
  };

  const exportData = () => {
    const data = {
      products,
      settings,
      transactions,
      version: "1.1",
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pos_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    playBeep('success');
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Peringatan: Mengimpor data akan menimpa SEMUA data yang ada (Produk, Histori, & Setelan). Lanjutkan?")) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.products) {
          setProducts(data.products);
          setLocal(STORAGE_KEYS.PRODUCTS, data.products);
        }
        if (data.settings) {
          setSettings(data.settings);
          setLocal(STORAGE_KEYS.SETTINGS, data.settings);
        }
        if (data.transactions) {
          setTransactions(data.transactions);
          setLocal(STORAGE_KEYS.TRANSACTIONS, data.transactions);
        }
        alert("Data berhasil diimpor! Aplikasi akan memuat ulang data.");
        playBeep('success');
      } catch (err) {
        alert("Gagal mengimpor data. Format file tidak valid.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearAllData = () => {
    if (confirm("BAHAYA: Anda akan menghapus SELURUH data aplikasi (Produk, Transaksi, dan Setelan). Tindakan ini tidak dapat dibatalkan.\n\nApakah Anda benar-benar yakin?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const filteredProducts = (products || []).filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ||
                         p.category?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "Semua" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["Semua", ...new Set((products || []).map(p => p.category).filter(Boolean))];

  return (
    <div className="min-h-screen bg-[#E4E3E0] font-sans text-[#1a1a1a] selection:bg-[#5A5A40] selection:text-white">
      <AnimatePresence>
        {viewToAuth && !isForgotPinOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setViewToAuth(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-8 md:p-10 shadow-2xl relative z-10 w-full max-w-sm overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#5A5A40] to-black opacity-10" />
              
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-[#F5F5F0] rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  >
                    <SettingsIcon className="w-10 h-10 text-[#5A5A40]" />
                  </motion.div>
                </div>
                <h2 className="text-2xl font-serif font-black text-[#1a1a1a] mb-2 uppercase tracking-tight">Otoritas Diperlukan</h2>
                <p className="text-sm text-gray-400 font-medium tracking-wide">Masukkan PIN Admin untuk mengakses menu ini</p>
              </div>

              <form onSubmit={handlePinSubmit} className="space-y-6">
                <div className="relative">
                  <input 
                    type="password" 
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setPinInput(val);
                      if (val.length === 4) {
                        // Small delay to allow user to see the last digit or just auto-submit
                        setTimeout(() => {
                           // Use current value or state might be stale in this specific closure
                           // But pinInput is being updated, so let's check the local 'val'
                           if (val === settings.adminPin) {
                             setIsAuthenticated(true);
                             if (viewToAuth) {
                               setView(viewToAuth);
                               setViewToAuth(null);
                             }
                             setIsMenuOpen(false);
                             setPinInput("");
                             setPinError(false);
                             setFailedAttempts(0);
                           } else {
                             setPinError(true);
                             setPinInput("");
                             setFailedAttempts(prev => prev + 1);
                           }
                        }, 100);
                      }
                    }}
                    placeholder="••••"
                    autoFocus
                    className={cn(
                      "w-full text-center text-4xl font-black tracking-[1em] py-5 bg-[#F5F5F0] rounded-3xl border-2 transition-all outline-none pl-[0.5em]",
                      pinError ? "border-red-500 bg-red-50 text-red-600" : "border-transparent focus:border-[#5A5A40] text-[#5A5A40]"
                    )}
                  />
                  <AnimatePresence>
                    {(pinError || failedAttempts > 0) && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-center mt-3 space-y-2"
                      >
                        {pinError && (
                          <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">
                            PIN Salah! Silakan coba lagi.
                          </p>
                        )}
                        {failedAttempts >= 2 && (
                          <button 
                            type="button"
                            onClick={handleResetPin}
                            className="text-[#5A5A40] text-[9px] font-bold uppercase tracking-widest underline decoration-2 underline-offset-4 hover:text-black transition-colors"
                          >
                            Lupa PIN? Reset via Pertanyaan
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setViewToAuth(null)}
                    className="py-4 rounded-2xl bg-gray-100 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="py-4 rounded-2xl bg-[#5A5A40] text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-[#5A5A40]/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    Masuk
                  </button>
                </div>
              </form>

              <div className="mt-8 pt-8 border-t border-gray-50 flex items-center justify-center gap-3 grayscale opacity-30">
                <Package className="w-4 h-4" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase">POS Pintar Secure</span>
              </div>
            </motion.div>
          </div>
        )}

        {isForgotPinOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-xl"
              onClick={() => setIsForgotPinOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-8 md:p-10 shadow-2xl relative z-10 w-full max-w-sm overflow-hidden"
            >
               <h3 className="text-xl font-serif font-black text-[#1a1a1a] mb-6 uppercase tracking-tight">Lupa PIN</h3>
               <div className="mb-6">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pertanyaan Keamanan:</p>
                 <p className="text-sm font-bold text-[#5A5A40] italic">"{settings.securityQuestion}"</p>
               </div>

               <form onSubmit={handleForgotPinSubmit} className="space-y-6">
                 <div>
                   <input 
                     type="text"
                     value={forgotAnswer}
                     onChange={(e) => {
                       setForgotAnswer(e.target.value);
                       setForgotError(false);
                     }}
                     placeholder="Masukkan jawaban Anda"
                     autoFocus
                     className={cn(
                       "w-full px-6 py-4 bg-[#F5F5F0] rounded-2xl border-2 transition-all outline-none font-bold text-sm",
                       forgotError ? "border-red-500 bg-red-50" : "border-transparent focus:border-[#5A5A40]"
                     )}
                   />
                   {forgotError && (
                     <p className="text-red-500 text-[9px] font-black uppercase tracking-widest mt-2 px-1">Jawaban salah! Ingat-ingat lagi.</p>
                   )}
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <button 
                     type="button"
                     onClick={() => {
                        setIsForgotPinOpen(false);
                        setForgotAnswer("");
                     }}
                     className="py-4 rounded-2xl bg-gray-100 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-colors"
                   >
                     Batal
                   </button>
                   <button 
                     type="submit"
                     className="py-4 rounded-2xl bg-red-500 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-red-500/20 hover:scale-105 active:scale-95 transition-all"
                   >
                     Reset & Masuk
                   </button>
                 </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Bottom Navigation Menu */}
      <div className="fixed bottom-6 md:bottom-8 left-4 right-4 z-[60] flex items-center justify-end gap-3 pointer-events-none">
        {/* Shortcuts Hint - Desktop Only */}
        <div className="hidden lg:flex items-center gap-3 bg-white/20 backdrop-blur-md px-5 py-3 rounded-full border border-white/30 text-[9px] font-black uppercase tracking-widest text-[#5A5A40]/60 mr-auto transition-all hover:opacity-100 opacity-30 hover:bg-white/40">
          <span className="text-[#5A5A40]">PINAS PINTAR SHORTCUTS:</span>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-white/80 px-2 py-1 rounded shadow-sm border border-gray-100">F</kbd> <span>Cari</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-white/80 px-2 py-1 rounded shadow-sm border border-gray-100">ENTER</kbd> <span>Bayar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-white/80 px-2 py-1 rounded shadow-sm border border-gray-100">D</kbd> <span>Statistik</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-white/80 px-2 py-1 rounded shadow-sm border border-gray-100">S</kbd> <span>Kasir</span>
          </div>
        </div>
        {/* Floating Payment Bar moved here and integrated with menu positioning */}
        <AnimatePresence>
          {view === "sales" && cart.length > 0 && (
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="flex-1 pointer-events-auto lg:hidden"
            >
              <button 
                onClick={() => setIsCartOpen(true)}
                className="w-full bg-[#5A5A40] text-white p-4 rounded-[24px] md:rounded-[32px] shadow-2xl flex items-center justify-between group active:scale-95 transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Pesanan</p>
                    <p className="text-lg font-black leading-none mt-0.5">{formatCurrency(grandTotal)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl group-hover:bg-white/20 transition-colors">
                  <span className="text-[10px] font-black uppercase tracking-widest">Bayar</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-end gap-4 pointer-events-auto">
          <AnimatePresence>
            {isMenuOpen && (
            <motion.nav 
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-[24px] md:rounded-[32px] p-2 flex flex-col gap-2 min-w-[120px]"
            >
              <button 
                onClick={() => handleViewChange("dashboard")}
                className={cn(
                  "p-3 rounded-xl transition-all duration-300 flex items-center gap-3 w-full",
                  view === "dashboard" ? "bg-[#5A5A40] text-white shadow-lg" : "text-gray-400 hover:text-[#5A5A40] hover:bg-[#F5F5F0]"
                )}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
              </button>
              <button 
                onClick={() => handleViewChange("sales")}
                className={cn(
                  "p-3 rounded-xl transition-all duration-300 flex items-center gap-3 w-full",
                  view === "sales" ? "bg-[#5A5A40] text-white shadow-lg" : "text-gray-400 hover:text-[#5A5A40] hover:bg-[#F5F5F0]"
                )}
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Kasir</span>
              </button>

              {view === "sales" && (
                <button 
                  onClick={() => { setIsCartOpen(true); setIsMenuOpen(false); }}
                  className="p-3 rounded-xl bg-orange-500 text-white shadow-lg transition-all duration-300 flex items-center gap-3 w-full hover:bg-orange-600 active:scale-95"
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Bayar</span>
                </button>
              )}

              <button 
                onClick={() => handleViewChange("products")}
                className={cn(
                  "p-3 rounded-xl transition-all duration-300 flex items-center gap-3 w-full",
                  view === "products" ? "bg-[#5A5A40] text-white shadow-lg" : "text-gray-400 hover:text-[#5A5A40] hover:bg-[#F5F5F0]"
                )}
              >
                <Package className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Produk</span>
              </button>
              <button 
                onClick={() => handleViewChange("history")}
                className={cn(
                  "p-3 rounded-xl transition-all duration-300 flex items-center gap-3 w-full",
                  view === "history" ? "bg-[#5A5A40] text-white shadow-lg" : "text-gray-400 hover:text-[#5A5A40] hover:bg-[#F5F5F0]"
                )}
              >
                <Clock className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Histori</span>
              </button>
              <button 
                onClick={() => handleViewChange("settings")}
                className={cn(
                  "p-3 rounded-xl transition-all duration-300 flex items-center gap-3 w-full",
                  view === "settings" ? "bg-[#5A5A40] text-white shadow-lg" : "text-gray-400 hover:text-[#5A5A40] hover:bg-[#F5F5F0]"
                )}
              >
                <SettingsIcon className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Setelan</span>
              </button>

              {isAuthenticated && (
                <button 
                  onClick={handleLogout}
                  className="p-3 rounded-xl bg-red-50 text-red-600 transition-all duration-300 flex items-center gap-3 w-full hover:bg-red-100 mt-2"
                >
                  <X className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Kunci Menu</span>
                </button>
              )}
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
    </div>

      {/* Main Content */}
      <main className="min-h-screen pb-32">
        {/* PWA Install Banner */}
        <AnimatePresence>
          {deferredPrompt && !isStandalone && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-[#5A5A40] text-white px-4 md:px-8 py-3 flex items-center justify-between overflow-hidden relative z-[45]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Download className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest leading-none">Aplikasi Dapat Diinstal</p>
                  <p className="text-[9px] text-white/70 mt-1">Gunakan POS PINTAR langsung dari layar utama HP Anda.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleInstallClick}
                  className="px-4 py-2 bg-white text-[#5A5A40] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#F5F5F0] transition-colors shadow-sm"
                >
                  Instal Sekarang
                </button>
                <button 
                  onClick={() => setDeferredPrompt(null)}
                  className="p-2 text-white/50 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
                ref={searchInputRef}
                type="text"
                placeholder="Cari... (Klik '/' atau 'f')"
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
              <div className="lg:col-span-10 grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-10 lg:col-span-10">
                  <motion.div 
                    layout
                    className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4"
                  >
                    <AnimatePresence mode="popLayout">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((product, idx) => {
                          const cartItem = cart.find(item => item.id === product.id);
                          return (
                            <motion.div
                              key={product.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              transition={{ delay: idx * 0.03 }}
                            >
                              <ProductCard 
                                product={product}
                                onAdd={addToCart}
                                onUpdateQty={updateQuantity}
                                cartQty={cartItem?.quantity || 0}
                              />
                            </motion.div>
                          );
                        })
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="col-span-full py-20 text-center"
                        >
                          <div className="bg-[#F5F5F0] w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4">
                            <Search className="w-6 h-6 text-gray-300" />
                          </div>
                          <p className="text-gray-400 font-serif italic">Produk tidak ditemukan</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>

                {/* Categories on the Right of Products */}
                <div className="md:col-span-2 lg:col-span-2">
                  <div className="sticky top-32 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5A5A40] mb-4 text-center md:text-left">Kategori</p>
                    <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 scrollbar-hide">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={cn(
                            "px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap text-center",
                            selectedCategory === cat 
                              ? "bg-[#5A5A40] text-white shadow-lg shadow-[#5A5A40]/20" 
                              : "bg-white text-gray-400 hover:bg-[#F5F5F0] border border-gray-100"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Payment Bar for Mobile/Tablet was moved into bottom menu stack */}

              {/* Desktop Cart Sidebar */}
              <div className="hidden xl:block lg:col-span-2">
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
                    cartDiscount={cartDiscount}
                    setCartDiscount={setCartDiscount}
                    discountAmount={discountAmount}
                    generateReceiptNo={generateReceiptNo}
                    completeTransaction={() => completeTransaction()}
                    setIsCartOpen={setIsCartOpen}
                    btError={btError}
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
          ) : view === "dashboard" ? (
            <DashboardView transactions={transactions} products={products} />
          ) : view === "history" ? (
            <HistoryView 
              transactions={transactions} 
              onReprint={handlePrint}
              onDownloadPDF={handleDownloadPDF}
              onBrowserPrint={handleBrowserPrint}
            />
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* PWA Section */}
              {!isStandalone && (
                <div className="bg-white rounded-[24px] md:rounded-[40px] p-5 md:p-10 shadow-sm border border-gray-50">
                  <div className="mb-6">
                    <h2 className="text-xl md:text-2xl font-serif font-black text-[#1a1a1a] flex items-center gap-3">
                      <Monitor className="w-6 h-6 text-[#5A5A40]" />
                      Aplikasi Mandiri (PWA)
                    </h2>
                    <p className="text-gray-400 text-xs mt-1 italic">Instalasi aplikasi di layar beranda</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-5 md:p-6 bg-[#5A5A40]/5 rounded-[24px] md:rounded-[32px] border border-[#5A5A40]/10">
                      <p className="text-[11px] text-gray-500 leading-relaxed mb-4 italic">
                        Aplikasi ini dapat diinstal di HP/Desktop agar muncul di layar beranda seperti aplikasi asli. Ini memungkinkan akses lebih cepat & performa lebih stabil.
                      </p>
                      
                      {deferredPrompt ? (
                        <div className="space-y-3">
                          <button 
                            onClick={handleInstallClick}
                            className="w-full py-4 bg-[#5A5A40] text-white rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Instal Aplikasi Sekarang
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-4 bg-white/50 rounded-2xl border border-dashed border-[#5A5A40]/20">
                            <h4 className="text-[10px] font-black text-[#5A5A40] uppercase mb-2 tracking-widest">Instalasi Manual:</h4>
                            <ul className="text-[10px] text-gray-500 space-y-2 list-disc pl-4 italic">
                              <li><strong>Android:</strong> Klik <Menu className="inline w-3 h-3" /> lalu <strong>"Instal Aplikasi"</strong>.</li>
                              <li><strong>iOS:</strong> Klik <strong>Share</strong> lalu <strong>"Add to Home Screen"</strong>.</li>
                              <li><strong>Desktop:</strong> Klik ikon <strong>Install</strong> di URL bar (Kiri Browser).</li>
                            </ul>
                          </div>
                          <button 
                            onClick={() => window.location.reload()}
                            className="w-full py-4 bg-white text-[#5A5A40] border border-[#5A5A40]/20 rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#5A5A40] hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Cek Ulang (Refresh Halaman)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

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
                  
                  {settingsBtError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[10px] space-y-1">
                      <p className="font-bold">❌ Gagal Menyambung</p>
                      <p className="opacity-80">{settingsBtError}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button 
                      onClick={async () => {
                        try {
                          setSettingsBtError(null);
                          const device = await requestPrinter();
                          setBtDevice(device);
                          device.addEventListener('gattserverdisconnected', () => {
                            setBtDevice(null);
                          });
                          alert(`Terhubung ke: ${device.name || "Bluetooth Printer"}\n\nSiap digunakan untuk mencetak struk.`);
                        } catch (err: any) {
                          if (err.message.includes("Dibatalkan")) return;
                          setSettingsBtError(`Gagal terhubung: ${err.message}`);
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
                          setSettingsBtError(null);
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
                          if (err.message.includes("Dibatalkan")) return;
                          setSettingsBtError(`Error Test Print: ${err.message}`);
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
                  <div className="flex flex-col items-center justify-center p-8 bg-[#F5F5F0] rounded-[24px] border-2 border-dashed border-[#5A5A40]/20 mb-6">
                    <img src="/logo.svg" alt="POS PINTAR Logo" className="w-24 h-24 shadow-lg rounded-2xl bg-white p-2" />
                    <p className="text-[10px] font-bold text-[#5A5A40] mt-4 uppercase tracking-widest leading-none">Ikon Aplikasi (PWA)</p>
                  </div>
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
                  <div>
                    <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">No. Telepon Toko</label>
                    <input 
                      name="storePhone"
                      type="tel"
                      defaultValue={settings.storePhone}
                      required
                      className="w-full bg-[#F5F5F0] border-none rounded-xl md:rounded-2xl py-3.5 md:py-4 px-5 md:px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold text-sm"
                      placeholder="Contoh: 0812-3456-7890"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Pesan Penutup Struk (Footer)</label>
                    <textarea 
                      name="receiptFooter"
                      defaultValue={settings.receiptFooter}
                      rows={2}
                      className="w-full bg-[#F5F5F0] border-none rounded-xl md:rounded-2xl py-3.5 md:py-4 px-5 md:px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all resize-none font-medium text-sm"
                      placeholder="Contoh: Terima Kasih Atas Kunjungan Anda"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Catatan Header Tambahan</label>
                    <input 
                      name="receiptHeader"
                      defaultValue={settings.receiptHeader}
                      className="w-full bg-[#F5F5F0] border-none rounded-xl md:rounded-2xl py-3.5 md:py-4 px-5 md:px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all font-bold text-sm"
                      placeholder="Contoh: Wifi: POS_PINTAR / PW: 123"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest px-1">Integrasi Sistem</label>
                    <div className="p-4 bg-[#F5F5F0] rounded-2xl border border-gray-100 flex items-center justify-between">
                      <div>
                        <h4 className="text-[11px] font-bold text-[#1a1a1a]">Aplikasi Pintar (PWA)</h4>
                        <p className="text-[9px] text-gray-400 italic">Jadikan shortcut di layar depan</p>
                      </div>
                      <button
                        type="button"
                        onClick={deferredPrompt ? handleInstallClick : () => alert("Gunakan menu Browser -> 'Instal Aplikasi' atau 'Tambahkan ke Layar Utama' untuk instalasi manual.")}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-sm",
                          deferredPrompt 
                            ? "bg-[#5A5A40] text-white hover:opacity-90" 
                            : "bg-white text-gray-400 border border-gray-100"
                        )}
                      >
                        {deferredPrompt ? <Download className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                        {deferredPrompt ? "Instal Sekarang" : "Manual Link"}
                      </button>
                    </div>
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
                  <div className="col-span-2 space-y-4 pt-4 border-t border-gray-100">
                    <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                       <Star className="w-3 h-3" />
                       Keamanan & Akses
                    </h3>
                    <div className="bg-red-50/50 p-6 rounded-3xl border border-red-100/50">
                      <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Pin Admin (4 Digit)</label>
                      <div className="relative max-w-[200px]">
                        <input 
                          name="adminPin"
                          type="password"
                          maxLength={4}
                          placeholder="••••"
                          defaultValue={settings.adminPin}
                          required
                          className="w-full bg-white border-2 border-red-100 rounded-xl md:rounded-2xl py-3.5 md:py-4 px-5 md:px-6 focus:ring-2 focus:ring-red-500 transition-all font-black text-xl tracking-[0.5em]"
                        />
                        <p className="text-[9px] text-gray-400 mt-2 italic">Digunakan untuk akses Dashboard, Produk, Histori, dan Setelan.</p>
                      </div>
                    </div>
                    <div className="bg-red-50/30 p-6 rounded-3xl border border-red-100/30 mt-4 space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Pertanyaan Keamanan (Reset PIN)</label>
                        <input 
                          name="securityQuestion"
                          defaultValue={settings.securityQuestion}
                          placeholder="Contoh: Nama ibu kandung?"
                          required
                          className="w-full bg-white border border-red-100 rounded-xl py-3 px-4 focus:ring-2 focus:ring-red-500 transition-all font-bold text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#5A5A40] mb-2 uppercase tracking-widest">Jawaban</label>
                        <input 
                          name="securityAnswer"
                          type="password"
                          defaultValue={settings.securityAnswer}
                          placeholder="Jawaban rahasia"
                          required
                          className="w-full bg-white border border-red-100 rounded-xl py-3 px-4 focus:ring-2 focus:ring-red-500 transition-all font-bold text-sm"
                        />
                        <p className="text-[9px] text-gray-400 mt-2 italic">Jawaban ini digunakan untuk membuka akses jika Anda lupa PIN.</p>
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

              {/* Data Management Section */}
              <div className="mt-12 pt-12 border-t border-gray-100 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-serif font-black text-[#1a1a1a]">Manajemen Data</h3>
                  <p className="text-gray-400 text-xs italic">Ekspor, impor, atau reset seluruh data aplikasi</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="p-6 bg-[#F5F5F0]/50 rounded-[32px] border border-gray-100 shadow-sm flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <Upload className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-sm">Backup (.json)</h4>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed italic">Unduh Produk, Histori, & Setelan ke file JSON.</p>
                    <button 
                      type="button"
                      onClick={exportData}
                      className="w-full py-4 bg-white text-[#5A5A40] border border-[#5A5A40]/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#5A5A40] hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      Ekspor Data
                    </button>
                  </div>

                  <div className="p-6 bg-[#F5F5F0]/50 rounded-[32px] border border-gray-100 shadow-sm flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                        <Download className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-sm">Restore (.json)</h4>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed italic">Gunakan file backup JSON untuk memulihkan data.</p>
                    <div className="relative">
                      <input 
                        type="file"
                        accept=".json"
                        onChange={importData}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full py-4 bg-white text-[#5A5A40] rounded-xl text-[10px] font-black uppercase tracking-widest border border-dashed border-[#5A5A40]/30 flex items-center justify-center gap-2">
                        <Upload className="w-4 h-4" />
                        Impor Data
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-red-50 rounded-[32px] border border-red-100 flex flex-col md:flex-row md:items-center justify-between gap-6 mt-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-red-600 text-sm uppercase tracking-wide">Pengaturan Pabrik</h4>
                      <p className="text-[10px] text-red-400 mt-0.5">Semua data akan dihapus permanen.</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={handleClearAllData}
                    className="px-8 py-4 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-md active:scale-95"
                  >
                    Kosongkan Data
                  </button>
                </div>
              </div>
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
                  cartDiscount={cartDiscount}
                  setCartDiscount={setCartDiscount}
                  discountAmount={discountAmount}
                  generateReceiptNo={generateReceiptNo}
                  completeTransaction={() => completeTransaction()}
                  setIsCartOpen={setIsCartOpen}
                  btError={btError}
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
        <div style={{ width: '380px' }} className="text-[#1a1a1a] font-mono text-[11px] leading-relaxed p-8 bg-white">
          <div className="text-center mb-6">
            {settings.logoUrl && <img src={settings.logoUrl} className="w-16 h-16 mx-auto mb-4 object-contain" referrerPolicy="no-referrer" />}
            <h2 className="text-base font-black uppercase leading-tight mb-1">{settings.storeName}</h2>
            <p className="text-[10px] opacity-70 whitespace-pre-wrap leading-tight">{settings.storeAddress}</p>
            {settings.storePhone && <p className="text-[10px] opacity-70">Telp: {settings.storePhone}</p>}
          </div>

          <div className="text-center opacity-20 mb-4">------------------------------------------</div>
          
          {reprintTransaction && (
            <div className="text-center font-black mb-4 bg-gray-100 py-1 rounded text-[10px]">*** REPRINT STRUK ***</div>
          )}

          <div className="space-y-1 mb-6 text-[10px]">
            <div className="grid grid-cols-[80px_1fr] gap-2">
              <span className="opacity-50">No. Faktur</span>
              <span className="text-right font-black">{(reprintTransaction?.receiptNo || customerInfo.receiptNo || " - ")}</span>
              
              <span className="opacity-50">Tanggal</span>
              <span className="text-right text-gray-500">
                {(() => {
                  const txNow = new Date();
                  const timestamp = reprintTransaction?.timestamp || (
                    customerInfo.customDate 
                      ? new Date(`${customerInfo.customDate}T${txNow.getHours().toString().padStart(2, '0')}:${txNow.getMinutes().toString().padStart(2, '0')}:${txNow.getSeconds().toString().padStart(2, '0')}`).getTime() 
                      : Date.now()
                  );
                  return new Date(timestamp).toLocaleString('id-ID', { 
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  });
                })()}
              </span>
            </div>
          </div>
          
          <div className="text-center opacity-20 mb-4">------------------------------------------</div>
          
          {/* Header Table */}
          <div className="grid grid-cols-[1fr_80px] gap-2 font-black text-[10px] opacity-50 mb-2 uppercase">
            <span>Item</span>
            <span className="text-right">Total</span>
          </div>

          <div className="space-y-3 mb-6">
            {(reprintTransaction?.items || cart || []).map(item => (
              <div key={item.id} className="space-y-0.5">
                <div className="flex justify-between items-start gap-4">
                  <span className="font-bold leading-tight flex-1">{item.name}</span>
                  <span className="font-black">{(item.price * item.quantity).toLocaleString("id-ID")}</span>
                </div>
                <div className="text-[9px] opacity-50 italic">
                  {item.quantity}x @{item.price.toLocaleString("id-ID")}
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center opacity-20 mb-4">------------------------------------------</div>
          
          <div className="space-y-2 mb-8 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="opacity-50 uppercase font-bold text-[9px]">Subtotal:</span>
              <span className="font-bold">{(reprintTransaction?.items || cart || []).reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString("id-ID")}</span>
            </div>

            {(reprintTransaction?.discount || discountAmount) > 0 && (
              <div className="flex justify-between items-center text-red-600">
                <span className="opacity-50 uppercase font-bold text-[9px]">Diskon:</span>
                <span className="font-bold">-{formatCurrency(reprintTransaction?.discount || discountAmount)}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="opacity-50 uppercase font-bold text-[9px]">Metode:</span>
              <span className="font-black">{(reprintTransaction?.customerInfo?.paymentMethod || customerInfo.paymentMethod || "Tunai").toUpperCase()}</span>
            </div>

            <div className="pt-3 mt-3 border-t border-gray-100">
              <div className="flex justify-between items-center text-lg font-black">
                <span className="text-[10px] tracking-tighter uppercase opacity-50">Total Akhir:</span>
                <span className="text-[#1a1a1a]">{formatCurrency(reprintTransaction?.grandTotal || grandTotal)}</span>
              </div>
            </div>
          </div>
          
          <div className="text-center space-y-2 py-6 border-t border-dashed border-gray-200 mt-4">
            {settings.receiptFooter ? (
              <p className="text-[10px] leading-relaxed uppercase tracking-widest whitespace-pre-wrap px-4">{settings.receiptFooter}</p>
            ) : (
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest">Terima Kasih</p>
                <p className="text-[8px] opacity-50 uppercase tracking-widest">Barang yang sudah dibeli tidak dapat ditukar</p>
              </div>
            )}
          </div>
          <div className="text-center opacity-10 mt-2">PINAS PINTAR V1.1</div>
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
            font-family: 'Courier New', Courier, monospace !important;
            color: black;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}} />
      <div id="printable-receipt" className="hidden print:block text-black text-[11px] leading-relaxed" style={{ width: '80mm' }}>
        <div className="text-center mb-5">
          {settings.logoUrl && <img src={settings.logoUrl} className="w-16 h-16 mx-auto mb-2 object-contain" referrerPolicy="no-referrer" />}
          <h2 className="text-sm font-black uppercase leading-tight">{settings.storeName}</h2>
          <p className="text-[10px] leading-tight whitespace-pre-wrap opacity-80">{settings.storeAddress}</p>
          {settings.storePhone && <p className="text-[10px]">Telp: {settings.storePhone}</p>}
        </div>
        
        <div className="text-center opacity-40 mb-3">--------------------------------</div>
        
        {reprintTransaction && <div className="text-center font-bold mb-2 text-[10px]">*** REPRINT STRUK ***</div>}

        <div className="space-y-1 mb-4 text-[10px]">
          <div className="grid grid-cols-[80px_1fr] gap-1">
            <span>Faktur</span>
            <span className="text-right font-bold">{(reprintTransaction?.receiptNo || customerInfo.receiptNo || " - ")}</span>
            <span>Waktu</span>
            <span className="text-right">{new Date(reprintTransaction?.timestamp || Date.now()).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        
        <div className="text-center opacity-40 mb-3">--------------------------------</div>
        
        <div className="space-y-3 mb-4">
          {(reprintTransaction?.items || cart || []).map(item => (
            <div key={item.id}>
              <div className="flex justify-between items-start gap-2">
                <span className="font-bold flex-1 leading-tight">{item.name}</span>
                <span className="font-bold">{(item.price * item.quantity).toLocaleString("id-ID")}</span>
              </div>
              <div className="text-[10px] ml-2 opacity-70">
                {item.quantity}x @{item.price.toLocaleString("id-ID")}
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-center opacity-40 mb-3">--------------------------------</div>
        
        <div className="space-y-1.5 mb-6 text-[10px]">
          <div className="flex justify-between">
            <span>SUBTOTAL:</span>
            <span>{(reprintTransaction?.items || cart || []).reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString("id-ID")}</span>
          </div>
          {(reprintTransaction?.discount || discountAmount) > 0 && (
            <div className="flex justify-between text-black">
              <span>DISKON:</span>
              <span>-{formatCurrency(reprintTransaction?.discount || discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm pt-2 border-t border-black mt-2">
            <span>TOTAL:</span>
            <span>{formatCurrency(reprintTransaction?.grandTotal || grandTotal)}</span>
          </div>
          <div className="flex justify-between pt-1 opacity-80">
            <span>BAYAR ({reprintTransaction?.customerInfo?.paymentMethod || customerInfo.paymentMethod || "Tunai"}):</span>
            <span>{formatCurrency(reprintTransaction?.grandTotal || grandTotal)}</span>
          </div>
        </div>
        
        <div className="text-center py-4 border-t border-dashed border-black mt-4">
          {settings.receiptFooter ? (
            <p className="text-[10px] whitespace-pre-wrap">{settings.receiptFooter}</p>
          ) : (
            <p className="text-[10px] font-bold">TERIMA KASIH</p>
          )}
        </div>
        <div className="text-center text-[8px] opacity-30 mt-2">POS PINAS PINTAR</div>
      </div>
    </div>
  );
}

function DashboardView({ transactions, products }: { transactions: Transaction[], products: Product[] }) {
  const stats = useMemo(() => {
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.grandTotal, 0);
    const totalOrders = transactions.length;
    const totalItems = transactions.reduce((sum, tx) => sum + tx.items.reduce((s, i) => s + i.quantity, 0), 0);
    
    // Top Products
    const productSales: Record<string, { name: string, quantity: number }> = {};
    transactions.forEach(tx => {
      tx.items.forEach(item => {
        if (!productSales[item.id]) {
          productSales[item.id] = { name: item.name, quantity: 0 };
        }
        productSales[item.id].quantity += item.quantity;
      });
    });
    const topProducts = Object.values(productSales)
      .map(p => ({ name: p.name, qty: p.quantity }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Sales by Category
    const categorySales: Record<string, number> = {};
    transactions.forEach(tx => {
      tx.items.forEach(item => {
        categorySales[item.category || "Lainnya"] = (categorySales[item.category || "Lainnya"] || 0) + (item.price * item.quantity);
      });
    });
    const categoryData = Object.entries(categorySales).map(([name, value]) => ({ name, value }));

    // Hourly Sales (simulated for today if possible, or just a trend)
    const hourlySales: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourlySales[i] = 0;
    
    transactions.forEach(tx => {
      const hour = new Date(tx.timestamp).getHours();
      hourlySales[hour] += tx.grandTotal;
    });
    const chartData = Object.entries(hourlySales).map(([hour, total]) => ({
      hour: `${hour}:00`,
      total
    }));

    // Inventory Stats
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const lowStockThreshold = 5;
    const lowStockProducts = products.filter(p => p.stock <= lowStockThreshold);
    const lowStockCount = lowStockProducts.length;

    // Stock Status Data for Pie Chart
    const stockStatusData = [
      { name: 'Aman', value: products.filter(p => (p.stock || 0) > lowStockThreshold).length },
      { name: 'Tipis', value: products.filter(p => (p.stock || 0) <= lowStockThreshold && (p.stock || 0) > 0).length },
      { name: 'Habis', value: products.filter(p => (p.stock || 0) === 0).length },
    ].filter(d => d.value > 0);

    return { 
      totalRevenue, 
      totalOrders, 
      totalItems, 
      topProducts, 
      categoryData, 
      chartData,
      totalInventoryValue,
      lowStockCount,
      lowStockProducts,
      stockStatusData
    };
  }, [transactions, products]);

  const COLORS = ['#5A5A40', '#8B8B6A', '#C2C2A3', '#E4E3E0', '#1a1a1a'];

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm flex items-center gap-5"
        >
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <DollarSign className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Pendapatan</p>
            <p className="text-xl font-black text-[#1a1a1a]">{formatCurrency(stats.totalRevenue)}</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm flex items-center gap-5"
        >
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Briefcase className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transaksi</p>
            <p className="text-xl font-black text-[#1a1a1a]">{stats.totalOrders}</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm flex items-center gap-5"
        >
          <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Item Terjual</p>
            <p className="text-xl font-black text-[#1a1a1a]">{stats.totalItems}</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm flex items-center gap-5"
        >
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rata-rata/Struk</p>
            <p className="text-xl font-black text-[#1a1a1a]">
              {formatCurrency(stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0)}
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm flex items-center gap-5 lg:hidden xl:flex"
        >
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nilai Total Stok</p>
            <p className="text-xl font-black text-[#1a1a1a]">{formatCurrency(stats.totalInventoryValue)}</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={cn(
            "p-6 rounded-[32px] border shadow-sm flex items-center gap-5",
            stats.lowStockCount > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"
          )}
        >
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center",
            stats.lowStockCount > 0 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
          )}>
            <Star className={cn("w-7 h-7", stats.lowStockCount > 0 && "animate-pulse")} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stok Tipis</p>
            <p className={cn(
              "text-xl font-black",
              stats.lowStockCount > 0 ? "text-red-600" : "text-emerald-600"
            )}>
              {stats.lowStockCount} Item
            </p>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 bg-white rounded-[40px] p-6 md:p-8 shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-serif font-black text-[#1a1a1a]">Tren Penjualan</h3>
              <p className="text-xs text-gray-400 mt-1">Akumulasi pendapatan per jam</p>
            </div>
            <TrendingUp className="w-5 h-5 text-[#5A5A40]" />
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} dy={10} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', fontWeight: 900 }}
                  formatter={(value: number) => [formatCurrency(value), "Penjualan"]}
                />
                <Bar dataKey="total" fill="#5A5A40" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#5A5A40] rounded-[40px] p-6 md:p-8 shadow-xl shadow-[#5A5A40]/10 text-white">
          <h3 className="text-lg font-serif font-black mb-6">Produk Terlaris</h3>
          <div className="space-y-5">
            {stats.topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-black text-xs">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold truncate">{p.name}</p>
                  <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(p.qty / stats.topProducts[0].qty) * 100}%` }}
                      className="bg-white h-full"
                    />
                  </div>
                </div>
                <span className="text-xs font-black">{p.qty}x</span>
              </div>
            ))}
            {stats.topProducts.length === 0 && (
              <div className="text-center py-10 opacity-50 flex flex-col items-center gap-3">
                <Star className="w-10 h-10" />
                <p className="text-xs font-serif italic">Belum ada data penjualan</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[40px] p-6 md:p-8 shadow-sm border border-gray-50 lg:col-span-1">
          <h3 className="text-lg font-serif font-black mb-2 text-[#1a1a1a]">Kesehatan Stok</h3>
          <p className="text-xs text-gray-400 mb-6 font-medium">Status ketersediaan inventaris</p>
          <div className="h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.stockStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.stockStatusData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.name === 'Aman' ? '#10b981' : entry.name === 'Tipis' ? '#f59e0b' : '#ef4444'} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Akurasi</span>
              <Package className="w-5 h-5 text-[#5A5A40] mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {stats.stockStatusData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: entry.name === 'Aman' ? '#10b981' : entry.name === 'Tipis' ? '#f59e0b' : '#ef4444' }} 
                />
                <span className="text-[10px] font-bold text-gray-500 truncate">{entry.name}: {entry.value} Item</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Robust Inventory Report Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Low Stock Alerts */}
        <div className="bg-white rounded-[40px] p-6 md:p-8 shadow-sm border border-gray-50 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                stats.lowStockCount > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
              )}>
                <Package className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-serif font-black text-[#1a1a1a]">Stok Tipis</h3>
            </div>
            {stats.lowStockCount > 0 && (
              <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                {stats.lowStockCount} ALERT
              </span>
            )}
          </div>
          
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {stats.lowStockProducts.map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 bg-[#F5F5F0]/50 rounded-2xl border border-transparent hover:border-[#5A5A40]/10 transition-all">
                <div>
                  <p className="text-sm font-bold text-[#1a1a1a]">{p.name}</p>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{p.category}</p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-sm font-black",
                    p.stock === 0 ? "text-red-500" : "text-orange-500"
                  )}>
                    {p.stock}
                  </p>
                  <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">Sisa unit</p>
                </div>
              </div>
            ))}
            {stats.lowStockProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 opacity-30 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Save className="w-8 h-8" />
                </div>
                <p className="text-xs font-serif italic italic">Semua stok aman!</p>
              </div>
            )}
          </div>
        </div>

        {/* Inventory Value Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-[40px] p-6 md:p-8 shadow-sm border border-gray-50 overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-serif font-black text-[#1a1a1a]">Nilai Inventaris</h3>
              <p className="text-xs text-gray-400 mt-1">Status stok & estimasi nilai aset</p>
            </div>
            <div className="flex items-center gap-2 bg-[#F5F5F0] rounded-xl px-4 py-2">
              <DollarSign className="w-4 h-4 text-[#5A5A40]" />
              <span className="text-[10px] font-black text-[#5A5A40] uppercase tracking-widest">
                Asset: {formatCurrency(stats.totalInventoryValue)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Produk</th>
                  <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Kategori</th>
                  <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Stok</th>
                  <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.sort((a,b) => a.stock - b.stock).slice(0, 10).map(p => (
                  <tr key={p.id} className="group hover:bg-[#F5F5F0]/30 transition-colors">
                    <td className="py-4">
                      <p className="text-sm font-bold text-[#1a1a1a] group-hover:text-[#5A5A40] transition-colors">{p.name}</p>
                    </td>
                    <td className="py-4">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.category}</span>
                    </td>
                    <td className="py-4 text-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                        p.stock <= 5 ? "bg-red-50 text-red-600" : "bg-[#F5F5F0] text-gray-500"
                      )}>
                        {p.stock} unit
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <p className="text-sm font-black text-[#1a1a1a]">{formatCurrency(p.price * p.stock)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.length > 10 && (
              <div className="mt-4 text-center">
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Showing bottom 10 by stock</p>
              </div>
            )}
          </div>
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
                      {tx.discount > 0 && (
                        <>
                          <span className="w-1 h-1 bg-gray-300 rounded-full" />
                          <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                            Disc: -{formatCurrency(tx.discount)}
                          </span>
                        </>
                      )}
                      <span className="w-1 h-1 bg-gray-300 rounded-full" />
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                        tx.customerInfo?.paymentMethod === "QRIS" ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"
                      )}>
                        {tx.customerInfo?.paymentMethod || "Tunai"}
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

interface CartContentProps {
  cart: CartItem[];
  updateQuantity: (id: string, delta: number) => void;
  setQuantity: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  customerInfo: CustomerInfo;
  setCustomerInfo: (info: CustomerInfo) => void;
  cartTotal: number;
  sc: number;
  pb1: number;
  rounding: number;
  grandTotal: number;
  handlePrint: () => void;
  handleDownloadPDF: () => void;
  handleBrowserPrint: () => void;
  isPrinting: boolean;
  pb1Rate: number;
  btDevice: any;
  cartDiscount: number;
  setCartDiscount: (val: number) => void;
  discountAmount: number;
  generateReceiptNo: (customDate?: string) => string;
  completeTransaction: () => void;
  setIsCartOpen: (isOpen: boolean) => void;
  btError?: string | null;
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
  btDevice,
  cartDiscount,
  setCartDiscount,
  discountAmount,
  generateReceiptNo,
  completeTransaction,
  setIsCartOpen,
  btError
}: CartContentProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold text-[#5A5A40] mb-1.5 md:mb-2 uppercase tracking-widest">Tanggal Transaksi</label>
          <div className="relative">
            <input 
              type="date" 
              value={customerInfo.customDate}
              onChange={(e) => {
                const newDate = e.target.value;
                setCustomerInfo({ 
                  ...customerInfo, 
                  customDate: newDate,
                  receiptNo: generateReceiptNo(newDate)
                });
              }}
              className="w-full bg-[#F5F5F0] border-none rounded-xl py-3 px-5 text-xs font-bold focus:ring-2 focus:ring-[#5A5A40] transition-all cursor-pointer"
            />
            <Clock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A40] pointer-events-none opacity-50" />
          </div>
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
        
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold text-[#5A5A40] mb-1.5 md:mb-2 uppercase tracking-widest text-center sm:text-left">Metode Pembayaran</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCustomerInfo({ ...customerInfo, paymentMethod: "Tunai" })}
              className={cn(
                "flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all font-black text-[10px] uppercase tracking-widest",
                customerInfo.paymentMethod === "Tunai" 
                  ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-lg shadow-[#5A5A40]/20" 
                  : "bg-white text-gray-400 border-gray-100 hover:bg-[#F5F5F0]"
              )}
            >
              <Wallet className="w-4 h-4" />
              Tunai
            </button>
            <button
              onClick={() => setCustomerInfo({ ...customerInfo, paymentMethod: "QRIS" })}
              className={cn(
                "flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all font-black text-[10px] uppercase tracking-widest",
                customerInfo.paymentMethod === "QRIS" 
                  ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-lg shadow-[#5A5A40]/20" 
                  : "bg-white text-gray-400 border-gray-100 hover:bg-[#F5F5F0]"
              )}
            >
              <QrCode className="w-4 h-4" />
              QRIS
            </button>
          </div>
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
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-[#5A5A40]" />
            <span className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-widest">Diskon</span>
          </div>
          <div className="relative">
            <input 
              type="number"
              placeholder="0"
              value={cartDiscount || ""}
              onChange={(e) => setCartDiscount(parseInt(e.target.value) || 0)}
              className="w-24 bg-[#F5F5F0] border-none rounded-lg py-1.5 px-3 text-right font-black text-xs focus:ring-1 focus:ring-[#5A5A40] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-400 font-bold">Rp</span>
          </div>
        </div>

        <div className="flex justify-between text-[10px] md:text-xs text-gray-400 font-medium">
          <span className="uppercase tracking-widest">Subtotal</span>
          <span className="font-bold">{formatCurrency(cartTotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-[10px] md:text-xs text-red-500 font-medium">
            <span className="uppercase tracking-widest">Potongan Diskon</span>
            <span className="font-bold">-{formatCurrency(discountAmount)}</span>
          </div>
        )}
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
        
        {btError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[10px] space-y-1">
            <p className="font-bold">❌ Bluetooth Error</p>
            <p className="opacity-80">{btError}</p>
            <p className="opacity-80 italic">Gunakan "Selesaikan Tanpa Cetak" atau "Browser Print".</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-6 md:pt-8">
          <button 
            onClick={() => handlePrint()}
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

          <button 
            type="button"
            onClick={() => {
              if (window.confirm("Selesaikan transaksi tanpa cetak struk?")) {
                completeTransaction();
                setIsCartOpen(false);
              }
            }}
            disabled={(cart?.length || 0) === 0 || isPrinting}
            className="col-span-2 bg-white border-2 border-gray-200 text-gray-500 rounded-xl md:rounded-2xl py-3 md:py-4 font-bold uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-[10px] md:text-xs disabled:opacity-50 active:scale-95 mb-1"
          >
            <CheckCircle className="w-4 h-4" />
            Selesaikan Tanpa Cetak (Bayar)
          </button>

          <div className="col-span-2 grid grid-cols-2 gap-3">
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
