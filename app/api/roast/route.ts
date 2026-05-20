import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import { NextResponse } from "next/server";

// Khởi tạo Client ngoài hàm để tối ưu hóa reuse instance (Low latency)
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

// Hàm helper tạo sự kiện Timeout chạy ngầm
const timeoutDelay = (ms: number): Promise<never> => {
  return new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("GOOGLE_API_TIMEOUT")), ms),
  );
};

export const POST = async (request: Request) => {
  try {
    const { image } = await request.json();

    // Xử lý Edge Case: Kiểm tra dữ liệu ảnh trống
    if (!image) {
      return NextResponse.json(
        { error: "Ủa rồi ảnh đâu sếp? Gửi chuỗi image giùm cái!" },
        { status: 400 },
      );
    }

    // Phẫu thuật chuỗi Base64 tách lấy dữ liệu thô và MimeType
    let base64Data = image;
    let mimeType = "image/jpeg";

    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    // Cấu hình SDK mới + Nhúng Prompt "Chê dạo" xéo sắc
    const aiCall = ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        "Roast this setup in Vietnamese based on your system instructions.",
      ],
      config: {
        systemInstruction: `You are a sarcastic, hyper-critical interior designer and tech-setup expert. 
Analyze the provided image of a "setup" and give a roast response in Vietnamese.

CRITICAL RULES:
1. If the image does NOT contain any kind of setup (e.g., just a pet, a random face, a blank wall, a close-up of an unrelated item, or a landscape), immediately roast the user for not knowing what a "setup" means or being illiterate.
2. If it is a real setup, analyze specific details (cable management, lighting, item placement, collectibles, color scheme, ergonomics).
3. Be funny, witty, and brutally honest. Use modern Vietnamese internet slang if appropriate (e.g., "báo", "vô tri", "ét ô ét"), but keep it clever, not purely toxic.
4. Output format: Keep the response concise (around 3-4 short paragraphs maximum) so it fits beautifully inside a shareable card component. Do NOT use markdown formatting like bold (**) or bullet points, just plain text paragraphs separated by newlines.`,
      },
    });

    // Cấu hình khoảng thời gian bắt lỗi/timeout ngầm (Ví dụ: Chờ tối đa 12 giây)
    const response = (await Promise.race([aiCall, timeoutDelay(12000)])) as GenerateContentResponse;
    const responseText = response.text;

    return NextResponse.json({ roast: responseText });
  } catch (error: unknown) {
    console.error("Backend API Error:", error);

    // Trả về thông báo vui nhộn nếu Google API nghẽn hoặc sập
    if (error instanceof Error && error.message === "GOOGLE_API_TIMEOUT") {
      return NextResponse.json(
        {
          error:
            "AI mải nhìn đống dây điện lộn xộn của bạn nên nghẹt thở đột quỵ rồi. Thử lại sau nhé sếp!",
        },
        { status: 504 },
      );
    }

    // Các lỗi hệ thống khác
    return NextResponse.json(
      {
        error:
          "AI đang bận đi mua thêm mô hình rồi, hoặc kết nối bị nghẽn. Thử lại sau nha!",
      },
      { status: 500 },
    );
  }
};
