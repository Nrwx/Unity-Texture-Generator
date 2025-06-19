from flask import request, jsonify
from model.ai_model import AIModel

class AIController:

    @staticmethod
    def handle_generate_image():
        try:
            data = request.get_json()
            prompt = data.get("prompt")
            model = data.get("model", "dall-e-2")

            if not prompt:
                return jsonify({"error": "Kein Prompt übermittelt"}), 400

            image_url = AIModel.generate_image_from_prompt(prompt, model)
            return jsonify({"success": True, "url": image_url}), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 500
