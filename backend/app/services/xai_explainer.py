from typing import Dict, Any

class XAIExplainer:
    def __init__(self):
        pass

    def explain_prediction(self, prediction_data: Dict[str, Any]) -> str:
        """
        Generates a natural language explanation for the prediction.
        """
        ticker = prediction_data.get("ticker", "Unknown")
        sentiment = prediction_data.get("sentiment", "Neutral")
        momentum = prediction_data.get("raw_momentum_pct", 0.0)
        
        reasoning = f"The AI model has analyzed {ticker} and detected a {sentiment} trend. "
        
        if momentum > 5:
            reasoning += f"This is driven by a strong positive momentum of {momentum}%, suggesting high buying pressure."
        elif momentum > 0:
            reasoning += f"There is a mild positive momentum of {momentum}%, indicating steady growth."
        elif momentum > -5:
            reasoning += f"The asset is experiencing a slight correction of {momentum}%, potentially a good entry point if fundamentals are strong."
        else:
            reasoning += f"Significant selling pressure is observed with a drop of {momentum}%. Caution is advised."
            
        return reasoning

explainer = XAIExplainer()
