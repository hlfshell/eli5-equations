import google.generativeai as genai
from arkaine.connectors.api import API
from arkaine.llms.google import Google
from arkaine.llms.llm import LLM, Prompt
from arkaine.tools.agent import Agent
from arkaine.tools.argument import Argument
from arkaine.tools.context import Context
from arkaine.utils.parser import Label, Parser
from arkaine.utils.templater import PromptLoader, PromptTemplate

llm = Google(model="gemini-2.0-flash-001")


class Explanation:
    def __init__(self, equation: str, explanation: str, breakdown: str):
        self.equation = equation
        self.explanation = explanation
        self.breakdown = breakdown

    def __str__(self):
        # If equation is not surrounded by $, then add it
        equation = self.equation
        if equation.strip()[0] != "$":
            equation = f"${equation}"
        if equation.strip()[-1] != "$":
            equation = f"{equation}$"

        out = f"Equation:\n\n{equation}\n\n"
        out += f"Explanation:\n\n{self.explanation}\n\n"
        out += f"Breakdown:\n\n{self.breakdown}\n\n"
        return out


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
            description="An agent that explains an equation in as clear and concise a manner as possible.",
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
        input("Press Enter to continue...")
        output, _ = self.__parser.parse(output)

        # Add an additional new line for the bullet points in breakdown.
        # If it's missing an initial *, add it.
        output["breakdown"] = output["breakdown"].replace("\n", "\n\n")
        if output["breakdown"].strip()[0] != "* ":
            output["breakdown"] = f"*{output['breakdown']}"

        print("BREAKDOWN")
        print(output["breakdown"])

        return Explanation(
            equation=output["equation"],
            explanation=output["explanation"],
            breakdown=output["breakdown"],
        )


explainer = EquationExplainingAgent(llm)

result = explainer(
    equation="\Pr(y_1 \geq y_2) = \frac{\exp(r(\mathbf{x}, y_1))}{\exp(r(\mathbf{x}, y_1)) + \exp(r(\mathbf{x}, y_2))}",
    info=("This is related to DPO, direct preference optimization",),
)

print(result)

with open("test.md", "w") as f:
    f.write(str(result))
