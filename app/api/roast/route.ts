import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import { NextResponse } from "next/server";

// Cấu hình thời gian tối đa chạy API lên 60 giây (Đặc quyền Vercel Pro)
export const maxDuration = 60;

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

    // Kích hoạt Gemini 3.5 Flash với Prompt phân nhánh [Khen Công Tâm - Chê Sắc Sảo]
    const aiCall = ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        "Analyze this setup in Vietnamese based on your system instructions.",
      ],
      config: {
        systemInstruction: `You are an objective, sharp-witted tech-setup expert and interior designer acting as an elite, fair referee ("Trọng tài công tâm").
Analyze the provided image and give a response in Vietnamese.

CRITICAL RULES:
1. ANTI-CHEAT: If the image does NOT contain any kind of desk setup, tech workspace, room setup, or collectible display (e.g., just a pet, a random face, a blank wall, a close-up of an unrelated item), immediately call out the user in exactly ONE single paragraph for being lost or uploading the wrong image.
2. CLASSIFICATION: Sincerely assess if the setup is genuinely good/clean/aesthetic (high-effort, nice gear, good theme) OR bad/mediocre/messy (unorganized, cable jungle, zero ergonomics).
3. IF IT IS A GOOD SETUP (Aesthetic/Clean):
   - First 1-2 sentences: Give genuine praise, clever compliments, or validate their excellent taste (e.g., appreciating their warm minimalist vibe, pegboard organization, monitor arm posture, or theme coordination).
   - Last 1-2 sentences: Constructively point out a micro-detail that can be optimized or suggest a cool desk accessory/gadget they can look up to elevate it to perfection.
4. IF IT IS A BAD/MEDIOCRE SETUP (Messy/Chaos):
   - First 2-3 sentences: Brutally yet hilariously expose the absolute worst catastrophe of the setup (e.g., the wild cable jungle, dust-gathering useless decor, or back-destroying ergonomics). Use sharp internet slang if appropriate ("báo", "vô tri", "ét ô ét", "gout").
   - Last 1-2 sentences: Offer a funny, sarcastic yet highly practical solution or specific item to grab to fix that mess.
5. OUTPUT FORMAT: The entire response MUST be strictly EXACTLY ONE single paragraph (around 4-5 sentences total). Absolutely NO line breaks, NO bullet points, and NO markdown formatting like bold (**). Output raw plain text only.`,
      },
    });

    // Cấu hình khoảng thời gian bắt lỗi/timeout ngầm (Ví dụ: Chờ tối đa 12 giây)
    const response = (await Promise.race([
      aiCall,
      timeoutDelay(12000),
    ])) as GenerateContentResponse;
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
