from pathlib import Path
import tempfile
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from arkaine.llms.google import Google
from arkaine.llms.llm import LLM, Prompt
from arkaine.tools.agent import Agent
from arkaine.tools.argument import Argument
from arkaine.tools.context import Context
from arkaine.utils.parser import Label, Parser
from arkaine.utils.templater import PromptLoader, PromptTemplate
import google.generativeai as genai
from PIL import Image
import io

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize the LLM
# llm = Google(model="gemini-2.0-flash-001")
# google_client = genai.GenerativeModel("gemini-1.5-flash")
llm = Google(model="gemini-2.5-pro-preview-03-25", context_length=200_000)
google_client = genai.GenerativeModel("gemini-2.5-pro-preview-03-25")


class Explanation:
    def __init__(self, equation: str, explanation: str, breakdown: str):
        self.equation = equation
        self.explanation = explanation
        self.breakdown = breakdown

    def to_dict(self):
        # Format equation with LaTeX delimiters if needed
        equation = self.equation
        if equation.strip()[0] != "$":
            equation = f"${equation}"
        if equation.strip()[-1] != "$":
            equation = f"{equation}$"

        return {
            "equation": equation,
            "explanation": self.explanation,
            "breakdown": self.breakdown,
        }


class EquationExplainingAgent(Agent):

    def __init__(self, llm: LLM):
        self.__template: PromptTemplate = PromptLoader.load_prompt("equation")
        self.__parser: Parser = Parser(
            [
                Label(
                    name="equation",
                    data_type=str,
                ),
                Label(
                    name="explanation",
                    data_type=str,
                ),
                Label(
                    name="breakdown",
                    data_type=str,
                ),
            ]
        )

        super().__init__(
            name="EquationExplainingAgent",
            description="An agent that explains an equation in as clear and "
            "concise a manner as possible.",
            args=[
                Argument(
                    name="equation",
                    description="The equation to explain in latex format.",
                    type=str,
                    required=True,
                ),
                Argument(
                    name="info",
                    description="The context of the equation if available.",
                    type=str,
                    required=False,
                    default="",
                ),
            ],
            llm=llm,
        )

    def prepare_prompt(self, context: Context, equation, info) -> Prompt:
        prompt = self.__template.render(
            {
                "equation": equation,
                "context": info,
            }
        )
        return prompt

    def extract_result(
        self,
        context: Context,
        output: str,
    ):
        output, _ = self.__parser.parse(output)

        return Explanation(
            equation=clean_latex(output["equation"]),
            explanation=output["explanation"],
            breakdown=output["breakdown"],
        )


# Initialize the explainer agent
explainer = EquationExplainingAgent(llm)


def clean_latex(latex: str) -> str:
    delimiters = ["$", "$$"]
    equation = latex.strip()
    equation = (
        equation.replace("```latex", "").replace("```", "").replace("latex", "").strip()
    )
    for delimiter in delimiters:
        if equation.startswith(delimiter) and equation.endswith(delimiter):
            equation = equation[len(delimiter) : -len(delimiter)]
    return equation


@app.route("/api/explain", methods=["POST"])
def explain_equation():
    data = request.json
    equation = data.get("equation", "")
    context = data.get("context", "")

    if not equation:
        return jsonify({"error": "Equation is required"}), 400

    try:
        result = explainer(equation=equation, info=context)
        return jsonify(result.to_dict())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/picture-to-equation", methods=["POST"])
def picture_to_equation():
    if "image" not in request.files:
        return jsonify({"error": "No image file uploaded"}), 400

    image_file = request.files["image"]

    if image_file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    if not image_file.filename.lower().endswith((".png", ".jpg", ".jpeg")):
        return jsonify({"error": "File must be an image (PNG, JPG, JPEG)"}), 400

    img = Image.open(io.BytesIO(image_file.read()))

    # Convert image to equation
    result = google_client.generate_content(
        [
            "You are an OCR equation agent. You will transcribe this "
            "image, specifically focusing on the equation, then describe "
            "it in detail in latex format. ONLY output the equation in "
            "latex format and nothing else. If there is no equation, "
            "output an empty string.",
            img,
        ]
    )

    # If the text is surrounded by latex or markdown markers, remove them.
    equation = clean_latex(result.text)

    return jsonify({"equation": equation})


@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
