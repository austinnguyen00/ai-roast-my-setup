import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// 1. Khởi tạo Client ngoài hàm POST để tối ưu việc reuse instance (Low latency)
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

export const POST = async (request: Request) => {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "Ủa rồi ảnh đâu sếp? Gửi chuỗi image giùm cái!" },
        { status: 400 },
      );
    }

    // Tách phần dữ liệu Base64 thô và MimeType từ chuỗi client gửi lên
    let base64Data = image;
    let mimeType = "image/jpeg";

    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    // 2. Gọi mô hình gemini-3.5-flash theo cú pháp của SDK mới
    // Truyền trực tiếp dữ liệu ảnh inlineData vào mảng contents
    const response = await ai.models.generateContent({
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
      // Đưa luật "chê dạo" vào config.systemInstruction
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

    // Trích xuất kết quả text từ response object của SDK mới
    const responseText = response.text;

    return NextResponse.json({ roast: responseText });
  } catch (error) {
    console.error("Gemini SDK Error:", error);
    return NextResponse.json(
      {
        error:
          "AI đang bận dọn bàn của nó rồi, hoặc kết nối bị nghẽn. Thử lại sau nhé sếp!",
      },
      { status: 500 },
    );
  }
};
