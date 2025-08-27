
// Chave temporária para teste, remova após o teste!
const HUGGING_FACE_API_KEY = "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";

if (!HUGGING_FACE_API_KEY) {
  console.error("Hugging Face API Key is not set!");
  // In a real application, you might want to throw an error or show a user-friendly message
}

export async function queryHuggingFace(text: string): Promise<any> {
  if (!HUGGING_FACE_API_KEY) {
    throw new Error("Hugging Face API Key is missing. Please set REACT_APP_HUGGING_FACE_API_KEY environment variable.");
  }

  // You can change this model to any other suitable for your needs, e.g., a text generation model
  // For a general purpose LLM, you might use a model like 'gpt2' or 'facebook/bart-large-cnn'
  // For a simple sentiment analysis example, 'distilbert-base-uncased-finetuned-sst-2-english' is good
  const modelUrl = "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english";

  try {
    const response = await fetch(
      modelUrl,
      {
        headers: {
          Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: text }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Hugging Face API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error querying Hugging Face API:", error);
    throw error; // Re-throw to be handled by the calling component
  }
}
