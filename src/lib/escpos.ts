/**
 * ESC/POS Command Generator for Bluetooth Printers
 */

export class EscPos {
  private buffer: number[] = [];

  constructor() {
    this.reset();
  }

  private reset() {
    this.buffer = [0x1b, 0x40]; // ESC @ (Initialize)
  }

  text(content: string) {
    for (let i = 0; i < content.length; i++) {
      this.buffer.push(content.charCodeAt(i));
    }
    return this;
  }

  line(content: string = "") {
    this.text(content + "\r\n");
    return this;
  }

  bold(on: boolean = true) {
    this.buffer.push(0x1b, 0x45, on ? 1 : 0); // ESC E n
    return this;
  }

  align(position: "left" | "center" | "right") {
    const n = position === "left" ? 0 : position === "center" ? 1 : 2;
    this.buffer.push(0x1b, 0x61, n); // ESC a n
    return this;
  }

  size(width: number = 1, height: number = 1) {
    const n = ((width - 1) << 4) | (height - 1);
    this.buffer.push(0x1d, 0x21, n); // GS ! n
    return this;
  }

  cut() {
    this.buffer.push(0x1d, 0x56, 0); // GS V m
    return this;
  }

  feed(n: number = 3) {
    this.buffer.push(0x1b, 0x64, n); // ESC d n
    return this;
  }

  /**
   * Print a bitmask image (GS v 0)
   * @param width Width in pixels (must be multiple of 8 for best result)
   * @param height Height in pixels
   * @param data Bitmask data (1 bit per pixel, 8 pixels per byte)
   */
  image(width: number, height: number, data: Uint8Array) {
    const xL = (Math.ceil(width / 8)) & 0xff;
    const xH = ((Math.ceil(width / 8)) >> 8) & 0xff;
    const yL = height & 0xff;
    const yH = (height >> 8) & 0xff;

    this.buffer.push(0x1d, 0x76, 0x30, 0, xL, xH, yL, yH);
    this.buffer.push(...Array.from(data));
    return this;
  }

  getBuffer() {
    return new Uint8Array(this.buffer);
  }

  // Helper for receipt formatting
  async receiptHeader(storeName: string, address: string, phone: string, logoUrl?: string) {
    this.align("center");

    if (logoUrl) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = logoUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const maxWidth = 160;
          const scale = maxWidth / img.width;
          const width = maxWidth;
          const height = Math.floor(img.height * scale);
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          const imageData = ctx.getImageData(0, 0, width, height);
          const pixels = imageData.data;
          const bitmask = new Uint8Array(Math.ceil(width / 8) * height);
          
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = (y * width + x) * 4;
              const r = pixels[idx];
              const g = pixels[idx + 1];
              const b = pixels[idx + 2];
              const alpha = pixels[idx + 3];
              
              const brightness = (r + g + b) / 3;
              if (alpha > 128 && brightness < 128) {
                const byteIdx = y * Math.ceil(width / 8) + Math.floor(x / 8);
                const bitIdx = 7 - (x % 8);
                bitmask[byteIdx] |= (1 << bitIdx);
              }
            }
          }
          
          this.image(width, height, bitmask);
        }
      } catch (e) {
        console.error("Failed to load logo:", e);
      }
    } else {
      this.line("=".repeat(32));
    }

    this.size(2, 2)
      .bold(true)
      .line(storeName)
      .size(1, 1)
      .bold(false);
    
    if (address) {
      const words = address.split(" ");
      let line = "";
      for (const word of words) {
        if ((line + word).length > 32) {
          this.line(line.trim());
          line = word + " ";
        } else {
          line += word + " ";
        }
      }
      if (line) this.line(line.trim());
    }

    if (phone && phone !== "-") {
      this.line(`Telp: ${phone}`);
    }
    
    this.line("=".repeat(32));
    return this;
  }

  receiptOrderInfo(info: { name: string; phone?: string; receiptNo?: string; timestamp?: number }) {
    const time = info.timestamp ? new Date(info.timestamp) : new Date();
    const dateStr = time.toLocaleDateString("id-ID", { day: '2-digit', month: '2-digit', year: 'numeric' });

    this.align("left")
      .line(`No. Faktur: ${info.receiptNo || "-"}`)
      .line(`Tanggal   : ${dateStr}`)
      .line(`Nama : ${info.name || "Guest"}`);
      if (info.phone && info.phone !== "-") {
        this.line(`Telp : ${info.phone}`);
      }
    this.line("-".repeat(32));
    return this;
  }

  receiptItemHeader() {
    this.align("left");
    return this;
  }

  receiptItem(name: string, qty: number, price: number) {
    const total = qty * price;
    const formattedTotal = total.toLocaleString("id-ID");
    const label = `${name} (${qty}x)`;
    
    // Layout: 32 columns
    // Label can use up to 20 chars, then space, then price
    const priceStr = formattedTotal.padStart(10);
    const labelPart = label.padEnd(21);
    
    if (label.length > 21) {
      this.line(label);
      this.line(" ".repeat(21) + priceStr);
    } else {
      this.line(`${labelPart}${priceStr}`);
    }
    
    this.line(`    @${price.toLocaleString("id-ID")}`);
    return this;
  }

  receiptFooter(data: { 
    totalItems?: number; 
    total: number; 
    sc: number; 
    pb1: number; 
    rounding: number; 
    discount?: number;
    grandTotal: number;
    paymentMethod?: string;
  }, footerMessage?: string) {
    this.align("left")
      .line("-".repeat(32));
    
    if (data.discount && data.discount > 0) {
      this.line(`DISKON:`.padEnd(16) + `-Rp ${data.discount.toLocaleString("id-ID")}`.padStart(16));
    }

    this.line(`PAYMENT: ${data.paymentMethod?.toUpperCase() || "TUNAI"}`)
      .line(`TOTAL ITEM: ${data.totalItems || 0}`)
      .line(`TOTAL AKHIR:`.padEnd(16) + `Rp ${data.grandTotal.toLocaleString("id-ID")}`.padStart(16))
      .line("-".repeat(32))
      .align("center")
      .bold(true);
      
    if (footerMessage) {
      const words = footerMessage.split(" ");
      let line = "";
      for (const word of words) {
        if ((line + word).length > 32) {
          this.line(line.trim());
          line = word + " ";
        } else {
          line += word + " ";
        }
      }
      if (line) this.line(line.trim());
    } else {
      this.line("TERIMA KASIH")
        .line("SELAMAT BELANJA KEMBALI");
    }
      
    this.bold(false)
      .line("=".repeat(32))
      .feed(4);
    return this;
  }
}

/**
 * Common Bluetooth Printer Services UUIDs
 */
const COMMON_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // RPOS / RPP-02N
  "0000ff00-0000-1000-8000-00805f9b34fb", // Milestone / MTP-II
  "0000ae01-0000-1000-8000-00805f9b34fb", // BlueBamboo
  "0000e7e1-0000-1000-8000-00805f9b34fb", // Xprinter
  "00001101-0000-1000-8000-00805f9b34fb", // SPP (Classic)
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC
  "e7e1a33e-4959-4e33-a7ed-ea312e7485d7", // Zebra
  "0000fec7-0000-1000-8000-00805f9b34fb", // Joyosoft
  "0000fee7-0000-1000-8000-00805f9b34fb", // Joyosoft alternative
  "0000af01-0000-1000-8000-00805f9b34fb", // Generic
  "0000fee9-0000-1000-8000-00805f9b34fb", // Generic
  "00001800-0000-1000-8000-00805f9b34fb", // Generic Access
  "00001801-0000-1000-8000-00805f9b34fb", // Generic Attribute
  "0000ffe0-0000-1000-8000-00805f9b34fb", // Common BLE
  "0000ffe1-0000-1000-8000-00805f9b34fb", // Common BLE
];

/**
 * Bluetooth Printer Connection Helpers
 */
export async function requestPrinter() {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    throw new Error("Bluetooth tidak didukung di browser ini. Gunakan Chrome atau Edge (Android/Windows). Browser iOS/Safari tidak mendukung Web Bluetooth.");
  }

  try {
    // We use acceptAllDevices for maximum compatibility since printer names and services vary wildly
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: COMMON_PRINTER_SERVICES,
    });
    
    return device;
  } catch (error: any) {
    if (error.name === "NotFoundError" || error.message.includes("cancelled")) {
      throw new Error("Pencetakan dibatalkan.");
    }
    throw error;
  }
}

export async function printToBluetooth(device: any, buffer: Uint8Array) {
  let server;
  let retryCount = 0;
  const maxRetries = 3;

  const connectWithRetry = async (): Promise<any> => {
    try {
      console.log(`Connecting to GATT server (attempt ${retryCount + 1})...`);
      // If already connected, disconnect first to ensure a clean state
      if (device.gatt.connected) {
        console.log("Device already connected, disconnecting first...");
        await device.gatt.disconnect();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return await device.gatt.connect();
    } catch (e: any) {
      console.warn(`Connection attempt ${retryCount + 1} failed:`, e);
      if (retryCount < maxRetries) {
        retryCount++;
        const delay = 1000 * retryCount;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return connectWithRetry();
      }
      throw e;
    }
  };

  try {
    if (!device.gatt) {
      throw new Error("GATT tidak tersedia pada perangkat ini.");
    }

    server = await connectWithRetry();
    
    // Give the printer a moment to settle after connecting
    await new Promise(resolve => setTimeout(resolve, 800));
    
    if (!server.connected) {
      throw new Error("GATT Server gagal tersambung.");
    }
    
    let service;
    let characteristic;

    console.log("Discovering services...");

    // 1. Try common services first
    for (const serviceUuid of COMMON_PRINTER_SERVICES) {
      try {
        service = await server.getPrimaryService(serviceUuid);
        if (service) {
          const characteristics = await service.getCharacteristics();
          characteristic = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
          if (characteristic) break;
        }
      } catch (e) {
        // Skip and try next
      }
    }

    // 2. Fallback: Search in ALL primary services and ALL characteristics
    if (!characteristic) {
      console.log("Searching in all primary services...");
      try {
        const services = await server.getPrimaryServices();
        for (const s of services) {
          console.log(`Checking service: ${s.uuid}`);
          try {
            const characteristics = await s.getCharacteristics();
            for (const c of characteristics) {
              console.log(`  Characteristic: ${c.uuid} (props: ${JSON.stringify(c.properties)})`);
              if (c.properties.write || c.properties.writeWithoutResponse) {
                characteristic = c;
                service = s;
                console.log(`Found suitable characteristic in service ${s.uuid}: ${c.uuid}`);
                break;
              }
            }
            if (characteristic) break;
          } catch (e) {
            console.warn(`Failed to get characteristics for service ${s.uuid}`);
          }
        }
      } catch (e) {
        console.error("Failed to get all primary services", e);
      }
    }

    if (!characteristic) {
      throw new Error("Layanan atau Karakteristik printer tidak ditemukan. Pastikan printer dalam mode siap (Ready).");
    }

    // Explicit Initialize & Clear
    await characteristic.writeValue(new Uint8Array([0x1b, 0x40]));
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send in chunks (some printers have small buffers/limitations)
    const chunkSize = 20; // 20 bytes is standard for basic BLE MTU
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.slice(i, i + chunkSize);
      try {
        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(chunk);
          // Wait longer for withoutResponse to avoid overflowing buffer
          await new Promise(resolve => setTimeout(resolve, 50));
        } else {
          await characteristic.writeValue(chunk);
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      } catch (e) {
        console.warn("Write chunk failure, trying fallback writeValue:", e);
        try {
          await characteristic.writeValue(chunk);
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (innerE) {
          console.error("Total write failure", innerE);
          throw new Error("Gagal mengirim data ke printer. Coba matikan dan nyalakan ulang printer.");
        }
      }
    }

    // Small delay before disconnect to ensure buffer is processed by printer
    await new Promise(resolve => setTimeout(resolve, 1500));
  } catch (error: any) {
    console.error("Bluetooth print error:", error);
    if (error.message.includes("GATT Server is disconnected")) {
      throw new Error("Koneksi terputus tiba-tiba. Pastikan printer dekat dan baterai cukup.");
    }
    if (error.message.includes("User cancelled") || error.message.includes("cancelled")) {
      throw new Error("Pencetakan dibatalkan.");
    }
    if (error.message.includes("Connection attempt failed")) {
      throw new Error("Koneksi gagal. Coba matikan dan nyalakan ulang Bluetooth di HP/Laptop serta Printer.");
    }
    throw new Error(`Gagal mencetak: ${error.message} (Pastikan printer mendukung BLE. Web Bluetooth tidak mendukung printer Bluetooth Classic/SPP)`);
  } finally {
    if (server && server.connected) {
      try {
        await server.disconnect();
        console.log("GATT Server disconnected successfully");
      } catch (e) {
        console.warn("Error during disconnect:", e);
      }
    }
  }
}
