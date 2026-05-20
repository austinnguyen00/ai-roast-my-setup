"use client";

import React, { useState, useRef, useEffect } from "react";
import NextImage from "next/image";
import { toPng } from "html-to-image";

type AppStatus = "IDLE" | "COMPRESSING" | "LOADING" | "SUCCESS" | "ERROR";

const LOADING_PHRASES = [
  "Đang soi đống dây điện lộn xộn của bạn...",
  "AI đang nhắm mắt chịu đựng góc này...",
  "Đang quét mức độ vô tri của các món decor...",
  "Đang soạn văn mẫu để chuẩn bị hủy diệt setup này...",
  "Đang tính toán chi phí công thái học bằng niềm tin...",
];

const Home = () => {
  const [status, setStatus] = useState<AppStatus>("IDLE");
  const [image, setImage] = useState<string | null>(null);
  const [roastText, setRoastText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingPhrase, setLoadingPhrase] = useState(LOADING_PHRASES[0]);

  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hiệu ứng xoay vòng các câu sub-text vô tri khi đang loading
  // sau mỗi 2.5 giây để tăng tính giải trí và giảm cảm giác chờ đợi
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "LOADING") {
      let index = 0;
      interval = setInterval(() => {
        index = (index + 1) % LOADING_PHRASES.length;
        setLoadingPhrase(LOADING_PHRASES[index]);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [status]);

  // Tự động tắt Snackbar thông báo lỗi sau 4 giây
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  /** Hàm hiển thị thông báo lỗi nhanh */
  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setStatus("ERROR");
  };

  /** Logic xử lý nén ảnh bằng HTML5 Canvas (Client-side Compression) */
  const processAndSetImage = (file: File) => {
    // 1. Kiểm tra Edge Case kích thước > 10MB
    if (file.size > 10 * 1024 * 1024) {
      triggerError(
        "Ảnh gì mà nặng hơn 10MB dữ vậy sếp? Chụp giảm độ phân giải lại giùm em!",
      );
      return;
    }

    // Xác định xem file có thuộc diện cần nén hay không (> 4MB)
    const isHeavyImage = file.size > 4 * 1024 * 1024;

    // 2. Bật trạng thái COMPRESSING ngay lập tức nếu ảnh nặng
    if (isHeavyImage) {
      setStatus("COMPRESSING");
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Result = event.target?.result as string;

      // 3. Tiến hành xử lý nén bằng Canvas nếu ảnh nặng
      if (isHeavyImage) {
        const img = new Image();
        img.src = base64Result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Giới hạn chiều dài/rộng tối đa khoảng 1200px để giảm dung lượng
          const MAX_SIZE = 1200;
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          // Xuất ra chuỗi base64 dạng jpeg chất lượng 0.7
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          setImage(compressedBase64);

          // Hoàn thành hoàn toàn luồng xử lý mới trả về IDLE
          setStatus("IDLE");
        };
      } else {
        // Ảnh nhẹ < 4MB thì giữ nguyên và trả về IDLE luôn
        setImage(base64Result);
        setStatus("IDLE");
      }
    };
    reader.readAsDataURL(file);
  };

  /** Bắt sự kiện kéo thả & chọn file */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processAndSetImage(e.target.files[0]);
  };

  /** Bắt sự kiện kéo thả */
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  /** Bắt sự kiện thả file vào vùng drop */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) processAndSetImage(e.dataTransfer.files[0]);
  };

  /** Gọi API Route gửi ảnh sang cho Gemini xử lý */
  const handleStartRoast = async () => {
    if (!image) return;
    setStatus("LOADING");
    setRoastText("");

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });

      const data = await res.json();

      if (!res.ok) {
        triggerError(data.error || "Hệ thống AI oẳng rồi sếp ơi!");
        return;
      }

      setRoastText(data.roast);
      setStatus("SUCCESS");
    } catch {
      triggerError("Kết nối internet bị nghẽn rồi, thử lại phát nữa xem sếp.");
    }
  };

  /** Logic kết xuất Card kết quả thành file ảnh PNG để share */
  const downloadCardImage = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        quality: 0.95,
      });
      const link = document.createElement("a");
      link.download = "my-setup-roasted.png";
      link.href = dataUrl;
      link.click();
    } catch {
      alert("Lỗi xuất ảnh rồi, chụp màn hình thủ công giùm em nha sếp!");
    }
  };

  const resetApp = () => {
    setImage(null);
    setRoastText("");
    setStatus("IDLE");
  };

  return (
    <div className="min-h-screen bg-[#FFFDF6] text-black font-sans p-4 md:p-8 flex flex-col items-center justify-center selection:bg-yellow-300">
      {/* HEADER PHONG CÁCH NEO-BRUTALISM */}
      <header className="text-center mb-8 max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase bg-yellow-300 border-4 border-black p-4 inline-block transform -rotate-1 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          💥 AI Roast My Setup
        </h1>
        <p className="mt-6 font-bold text-lg text-neutral-700">
          Tải ảnh góc làm việc, tủ đồ chơi, phòng ngủ lên để nhận &quot;vé
          phạt&quot; từ chuyên gia AI Vision xéo sắc nhất 2026.
        </p>
      </header>

      {/* MAIN CONTENT */}
      <main className="w-full max-w-2xl flex flex-col items-center justify-center">
        {/* CHẾ ĐỘ CHỜ / UPLOAD (IDLE) */}
        {(status === "IDLE" ||
          status === "COMPRESSING" ||
          status === "ERROR") &&
          !roastText && (
            <div className="w-full flex flex-col gap-6">
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[280px] bg-white border-4 border-black border-dashed rounded-none flex flex-col items-center justify-center p-6 cursor-pointer transform transition-transform hover:-translate-y-1 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] bg-cover bg-center relative"
                style={{ backgroundImage: image ? `url(${image})` : "none" }}
              >
                {image && (
                  <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]" />
                )}
                <div className="relative bg-white border-2 border-black p-4 max-w-sm text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {image ? (
                    <p className="font-black text-green-600">
                      📸 Đã nhận ảnh! Click hoặc thả ảnh khác để đổi
                    </p>
                  ) : (
                    <>
                      <p className="font-black text-xl mb-1">
                        KÉO THẢ ẢNH VÀO ĐÂY
                      </p>
                      <p className="text-xs font-bold text-neutral-500">
                        Hoặc click để chọn file từ máy (Hỗ trợ tối đa 10MB)
                      </p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {image && status !== "COMPRESSING" && (
                <button
                  onClick={handleStartRoast}
                  className="w-full font-black text-xl uppercase bg-red-400 border-4 border-black p-4 tracking-wider transform transition-transform active:translate-x-[3px] active:translate-y-[3px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-red-500"
                >
                  🔥 Bắt đầu bóc phốt ngay!
                </button>
              )}
            </div>
          )}

        {/* CHẾ ĐỘ ĐANG QUÉT (LOADING) */}
        {status === "LOADING" && (
          <div className="w-full bg-blue-100 border-4 border-black p-8 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center gap-4 animate-pulse">
            <div className="w-16 h-16 border-8 border-black border-t-yellow-400 rounded-full animate-spin" />
            <h3 className="text-2xl font-black uppercase tracking-tight">
              AI đang phân tích...
            </h3>
            <p className="font-bold text-neutral-700 italic text-lg">
              &quot;{loadingPhrase}&quot;
            </p>
          </div>
        )}

        {/* CHẾ ĐỘ THÀNH CÔNG - THẺ KẾT QUẢ POSTER DỌC (SUCCESS) */}
        {roastText && (status === "SUCCESS" || status === "LOADING") && (
          <div className="w-full flex flex-col gap-6">
            {/* CONTAINER CHIẾC CARD DẠNG POSTER DỌC ĐỂ DOWNLOAD */}
            <div
              ref={cardRef}
              className="w-full bg-[#E3FAF5] border-4 border-black p-5 md:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-5"
            >
              {/* Phần trên: Khung ảnh setup full-width bảo toàn tỷ lệ gốc (Không crop) */}
              {image && (
                <div className="w-full border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white flex items-center justify-center">
                  <NextImage
                    src={image}
                    alt="Setup preview"
                    width={1200}
                    height={900}
                    unoptimized
                    className="w-full h-auto object-contain"
                  />
                </div>
              )}

              {/* Phần dưới: Tích hợp Frosted Glass mờ cho phần Text để tôn chữ */}
              <div className="w-full bg-white/85 backdrop-blur-md border-4 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
                <div>
                  <div className="border-b-2 border-dashed border-black pb-2 mb-4 flex justify-between items-center">
                    <span className="font-mono text-xs font-black bg-black text-white px-2 py-0.5">
                      REPORT CARD
                    </span>
                    <span className="font-mono text-xs font-bold text-neutral-500">
                      📍 AI Inspection Unit
                    </span>
                  </div>
                  <div className="text-sm font-bold text-neutral-800 leading-relaxed whitespace-pre-line font-mono">
                    {roastText}
                  </div>
                </div>
                <div className="mt-6 pt-2 border-t-2 border-black text-center font-mono text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                  ★ AI-Roast-My-Setup-2026 ★
                </div>
              </div>
            </div>

            {/* CỤM NÚT ĐIỀU KHIỂN SAU KHI CÓ KẾT QUẢ */}
            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <button
                onClick={downloadCardImage}
                className="flex-1 font-black bg-yellow-300 border-4 border-black p-3 text-lg uppercase tracking-wider transform transition-transform active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400"
              >
                💾 Tải ảnh thẻ (Share Threads)
              </button>
              <button
                onClick={resetApp}
                className="flex-1 font-black bg-white border-4 border-black p-3 text-lg uppercase tracking-wider transform transition-transform active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-neutral-100"
              >
                🔄 Thử góc khác
              </button>
            </div>
          </div>
        )}
      </main>

      {/* SNACKBAR THÔNG BÁO LỖI (FLOATING SNACKBAR) */}
      {errorMsg && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-red-300 border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-bounce">
          <p className="font-black text-sm text-black flex items-center gap-2">
            🚨 {errorMsg}
          </p>
        </div>
      )}
    </div>
  );
};

export default Home;
