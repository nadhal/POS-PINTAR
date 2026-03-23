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
    this.text(content + "\n");
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
  async receiptHeader(storeName: string, address: string, logoUrl?: string) {
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
          // Resize to fit printer (max width ~384px for 58mm)
          const maxWidth = 160; // Small logo
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
              
              // Simple thresholding
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
    }

    this.size(2, 2)
      .bold(true)
      .line(storeName)
      .size(1, 1)
      .bold(false)
      .line(address)
      .line("=".repeat(32));
    return this;
  }

  receiptOrderInfo(info: { name: string; phone?: string; receiptNo?: string }) {
    this.align("left")
      .bold(true).line("Informasi Pemesanan").bold(false)
      .line(`Nama Pemesan   : ${info.name}`)
      .line(`Nomor Telepon  : ${info.phone || "-"}`)
      .line(`No. Unik Struk : ${info.receiptNo || "-"}`)
      .line("-".repeat(32));
    return this;
  }

  receiptItemHeader() {
    this.align("left")
      .bold(true)
      .line("Nama Item       Jml    Harga")
      .bold(false);
    return this;
  }

  receiptItem(name: string, qty: number, price: number) {
    const namePart = name.padEnd(16).substring(0, 16);
    const qtyPart = qty.toString().padStart(3) + "x";
    const pricePart = price.toLocaleString().padStart(10);
    this.align("left").line(`${namePart} ${qtyPart} ${pricePart}`);
    return this;
  }

  receiptFooter(data: { 
    totalItems?: number; 
    total: number; 
    sc: number; 
    pb1: number; 
    rounding: number; 
    grandTotal: number;
    paymentMethod?: string;
  }) {
    this.align("left")
      .line("-".repeat(32))
      .line(`Total Item      ${(data.totalItems || 0).toString().padStart(3)}    ${data.total.toLocaleString().padStart(10)}`)
      .line("-".repeat(32))
      .bold(true).line("Total").bold(false)
      .line(`Subtotal        ${data.total.toLocaleString().padStart(16)}`)
      .line(`SC              ${data.sc.toLocaleString().padStart(16)}`)
      .line(`PB1             ${data.pb1.toLocaleString().padStart(16)}`)
      .line(`Rounding Total  ${data.rounding.toLocaleString().padStart(16)}`)
      .line("-".repeat(32))
      .bold(true)
      .line(`Grand Total     ${data.grandTotal.toLocaleString().padStart(16)}`)
      .bold(false)
      .line("(Termasuk Pajak)")
      .line("-".repeat(32))
      .line(`Metode Pembayaran: ${data.paymentMethod || "Tunai"}`)
      .feed(2)
      .align("center")
      .line("Terima Kasih")
      .line("Selamat Belanja Kembali")
      .feed(4);
    return this;
  }
}

/**
 * Bluetooth Printer Connection Helper
 */
export async function printToBluetooth(buffer: Uint8Array) {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    throw new Error("Bluetooth tidak didukung di browser ini. Gunakan Chrome atau Edge.");
  }

  try {
    // Some printers use different UUIDs, so we try to accept all devices
    // and list common printer service UUIDs in optionalServices.
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb", "00001101-0000-1000-8000-00805f9b34fb"],
    });

    if (!device.gatt) {
      throw new Error("GATT tidak tersedia pada perangkat ini.");
    }

    const server = await device.gatt.connect();
    
    // Try to find the printer service
    let service;
    try {
      service = await server.getPrimaryService("000018f0-0000-1000-8000-00805f9b34fb");
    } catch (e) {
      // Fallback to another common SPP UUID if the first one fails
      service = await server.getPrimaryService("00001101-0000-1000-8000-00805f9b34fb");
    }

    if (!service) {
      throw new Error("Layanan printer tidak ditemukan.");
    }

    // Get all characteristics and find one that supports 'write'
    const characteristics = await service.getCharacteristics();
    const characteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);

    if (!characteristic) {
      throw new Error("Karakteristik penulisan tidak ditemukan.");
    }

    // Send in chunks (some printers have small buffers)
    const chunkSize = 20;
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.slice(i, i + chunkSize);
      await characteristic.writeValue(chunk);
    }

    // Small delay before disconnect to ensure buffer is processed
    await new Promise(resolve => setTimeout(resolve, 500));
    await server.disconnect();
  } catch (error: any) {
    console.error("Bluetooth print error:", error);
    if (error.name === "NotFoundError") {
      throw new Error("Pencetakan dibatalkan atau perangkat tidak ditemukan.");
    }
    throw new Error(`Gagal mencetak: ${error.message}`);
  }
}
