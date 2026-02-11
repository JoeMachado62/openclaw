"""
Sales-specific function tools for AIME voice agent
Includes BANT qualification, objection handling, and follow-up scheduling
"""

import logging
from datetime import datetime, timedelta
from typing import Annotated
from livekit.agents import function_tool

logger = logging.getLogger("sales-tools")


class SalesTools:
    """Sales-specific tools for NEPQ-based qualification and objection handling"""

    def __init__(self, openclaw_base_url: str):
        self.openclaw_base_url = openclaw_base_url

    @function_tool
    async def qualify_lead(
        self,
        budget_range: Annotated[str, "Estimated budget (e.g., '$5K-$10K', '$10K-$25K', '$25K+')"],
        timeline: Annotated[str, "Implementation timeline (e.g., 'immediate', '1-3 months', '3-6 months', '6+ months')"],
        decision_maker: Annotated[bool, "Whether contact is the decision maker"],
        pain_points: Annotated[list[str], "List of identified pain points"],
    ) -> dict:
        """
        Qualify lead based on BANT criteria (Budget, Authority, Need, Timeline)

        This function calculates a lead score based on:
        - Budget alignment (higher budgets = higher scores)
        - Timeline urgency (immediate needs = higher scores)
        - Decision-making authority
        - Number and severity of pain points

        Returns:
            dict: Lead score, qualification status, and demo readiness
        """
        score = 0

        # Budget scoring (30 points max)
        if "$25K" in budget_range or "25K+" in budget_range:
            score += 30
        elif "$10K" in budget_range or "$15K" in budget_range or "$20K" in budget_range:
            score += 25
        elif "$5K" in budget_range:
            score += 15
        elif budget_range and budget_range.lower() != "unknown":
            score += 10

        # Timeline scoring (40 points max)
        timeline_lower = timeline.lower()
        if "immediate" in timeline_lower or "asap" in timeline_lower or "now" in timeline_lower:
            score += 40
        elif "1-3" in timeline_lower or "1 month" in timeline_lower or "2 month" in timeline_lower:
            score += 30
        elif "3-6" in timeline_lower or "quarter" in timeline_lower:
            score += 20
        elif "6" in timeline_lower or "year" in timeline_lower:
            score += 10

        # Decision maker authority (20 points max)
        if decision_maker:
            score += 20

        # Pain points (10 points max)
        pain_point_score = min(len(pain_points) * 3, 10)
        score += pain_point_score

        # Determine qualification level
        if score >= 70:
            qualification = "Hot"  # High priority, immediate follow-up
        elif score >= 50:
            qualification = "Warm"  # Good potential, schedule demo
        elif score >= 30:
            qualification = "Cold"  # Long-term nurture
        else:
            qualification = "Unqualified"  # Not a fit

        logger.info(f"Lead qualified: {qualification} (score: {score})")

        return {
            "score": score,
            "qualification": qualification,
            "ready_for_demo": score >= 60,
            "recommended_next_step": self._get_next_step(score, qualification),
        }

    def _get_next_step(self, score: int, qualification: str) -> str:
        """Determine recommended next step based on qualification"""
        if score >= 70:
            return "Schedule demo within 48 hours"
        elif score >= 50:
            return "Send proposal and schedule demo call"
        elif score >= 30:
            return "Add to nurture campaign, follow up in 2 weeks"
        else:
            return "Politely end conversation, add to long-term nurture"

    @function_tool
    async def handle_objection(
        self,
        objection_type: Annotated[str, "Type of objection: 'price', 'timing', 'competitor', 'authority', 'need'"],
        specific_concern: Annotated[str, "The specific concern the prospect raised"],
    ) -> dict:
        """
        Get recommended response framework for common sales objections

        Uses proven objection handling frameworks:
        - Price: Acknowledge → Value → ROI
        - Timing: Empathize → Urgency → Alternative
        - Competitor: Validate → Differentiate → Evidence
        - Authority: Respect → Involve → Equip
        - Need: Curiosity → Insight → Permission

        Args:
            objection_type: Category of objection
            specific_concern: Exact words the prospect used

        Returns:
            dict: Framework, example response, and recommended approach
        """
        responses = {
            "price": {
                "framework": "Acknowledge → Value → ROI",
                "approach": "Don't defend the price. Instead, shift to value and return on investment.",
                "example": "I understand budget is important. Let me ask - what would solving [pain point] be worth to your business? Many clients see [specific ROI] within [timeframe].",
                "follow_up_question": "If we could show you a path to [specific outcome], would the investment make sense?",
            },
            "timing": {
                "framework": "Empathize → Urgency → Alternative",
                "approach": "Validate their concern, then create urgency or offer a low-commitment option.",
                "example": "I totally get that timing isn't perfect right now. Out of curiosity, what specifically makes this not the right time? [Listen] What if we set up a pilot program that minimizes disruption while you're dealing with [concern]?",
                "follow_up_question": "If timing is the only concern, could we start with a small pilot to prove value?",
            },
            "competitor": {
                "framework": "Validate → Differentiate → Evidence",
                "approach": "Never badmouth competitors. Validate their choice, differentiate on unique value, provide proof.",
                "example": "They're a solid choice - lots of companies use them successfully. The key difference is [unique value proposition]. Can I share how [similar company] achieved [specific result] that they couldn't get elsewhere?",
                "follow_up_question": "What's most important to you in solving this problem - [our differentiator] or [their approach]?",
            },
            "authority": {
                "framework": "Respect → Involve → Equip",
                "approach": "Don't try to bypass the gatekeeper. Instead, help them sell internally.",
                "example": "That makes total sense - this is definitely a decision for [decision maker]. What information would help you make the case internally? I can put together a brief showing [specific ROI/value] for your conversation with them.",
                "follow_up_question": "Would it be helpful if I joined a brief call with you and [decision maker] to answer questions?",
            },
            "need": {
                "framework": "Curiosity → Insight → Permission",
                "approach": "They're saying they don't have the problem. Uncover the hidden pain with questions.",
                "example": "I appreciate you sharing that. Out of curiosity, how are you currently handling [related challenge]? [Listen] Interesting. And how much time/money does that currently take? [Listen] May I share one insight about what we're seeing in the market?",
                "follow_up_question": "Even if it's working okay now, would you be open to seeing how others in [industry] are doing it [faster/cheaper/better]?",
            },
        }

        # Default to "need" framework if objection type not recognized
        response = responses.get(objection_type.lower(), responses["need"])

        logger.info(f"Objection handled: {objection_type} - {specific_concern[:50]}")

        return {
            "framework": response["framework"],
            "approach": response["approach"],
            "example_response": response["example"],
            "follow_up_question": response["follow_up_question"],
            "objection_logged": True,
        }

    @function_tool
    async def schedule_follow_up(
        self,
        follow_up_type: Annotated[str, "Type of follow-up: 'call', 'email', 'demo', 'proposal', 'check_in'"],
        days_from_now: Annotated[int, "Days until follow-up (1-90)"],
        reason: Annotated[str, "Reason for follow-up"],
        contact_id: Annotated[str, "Contact ID"] = None,
    ) -> dict:
        """
        Schedule follow-up task in GoHighLevel CRM

        Creates a task with appropriate priority based on timeframe:
        - 1-3 days: High priority
        - 4-7 days: Normal priority
        - 8+ days: Low priority

        Args:
            follow_up_type: What type of follow-up action
            days_from_now: When to follow up (1-90 days)
            reason: Why we're following up
            contact_id: GHL contact ID (optional, will use current contact if not provided)

        Returns:
            dict: Task creation confirmation with due date and task ID
        """
        import httpx

        # Calculate due date
        due_date = (datetime.utcnow() + timedelta(days=days_from_now)).isoformat()

        # Determine priority based on urgency
        if days_from_now <= 3:
            priority = "high"
        elif days_from_now <= 7:
            priority = "normal"
        else:
            priority = "low"

        # Create task via OpenClaw bridge → GHL
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.openclaw_base_url}/api/ghl/tasks/create",
                    json={
                        "contact_id": contact_id,
                        "title": f"Follow-up: {follow_up_type.capitalize()}",
                        "description": reason,
                        "due_date": due_date,
                        "priority": priority,
                        "status": "open",
                    },
                    timeout=10.0,
                )

                if response.status_code == 200:
                    task_data = response.json()
                    logger.info(f"Follow-up scheduled: {follow_up_type} in {days_from_now} days")
                    return {
                        "success": True,
                        "task_id": task_data.get("id"),
                        "due_date": due_date,
                        "priority": priority,
                        "message": f"{follow_up_type.capitalize()} scheduled for {days_from_now} days from now",
                    }
                else:
                    logger.error(f"Failed to create task: {response.status_code}")
                    return {
                        "success": False,
                        "error": "Failed to schedule follow-up in CRM",
                    }

        except Exception as e:
            logger.error(f"Error scheduling follow-up: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    @function_tool
    async def log_sales_activity(
        self,
        activity_type: Annotated[str, "Type of activity: 'objection_handled', 'pain_point_identified', 'competitor_mentioned', 'budget_discussed'"],
        details: Annotated[str, "Details of the activity"],
        contact_id: Annotated[str, "Contact ID"] = None,
    ) -> dict:
        """
        Log important sales activities to contact timeline

        Captures key moments in the sales conversation:
        - Objections raised and how they were handled
        - Pain points identified
        - Competitors mentioned
        - Budget discussions

        This data helps with:
        - Coaching and training
        - Understanding common objections
        - Refining sales scripts
        - Providing context for future interactions

        Args:
            activity_type: Category of sales activity
            details: Specific details to log
            contact_id: GHL contact ID

        Returns:
            dict: Confirmation of activity logged
        """
        import httpx

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.openclaw_base_url}/api/bridge/log-activity",
                    json={
                        "contact_id": contact_id,
                        "activity_type": activity_type,
                        "details": details,
                        "timestamp": datetime.utcnow().isoformat(),
                    },
                    timeout=5.0,
                )

                logger.info(f"Sales activity logged: {activity_type}")

                return {
                    "success": response.status_code == 200,
                    "activity_type": activity_type,
                    "logged_at": datetime.utcnow().isoformat(),
                }

        except Exception as e:
            logger.error(f"Error logging sales activity: {e}")
            return {
                "success": False,
                "error": str(e),
            }
