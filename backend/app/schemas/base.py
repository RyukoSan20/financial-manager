"""
Shared schema behaviour.

Every form in this app keeps its state as strings, because that is what an
input element gives. When the form is submitted, a field the user did
not fill in is still an empty string, and the backend answers:

    "Input should be a valid date or datetime, input is too short"

or

    "Input should be a valid integer, unable to parse string as an integer"

Both are the same bug: an optional field that is empty arrives as `""`
instead of `None`.

`EmptyStringAsNone` drops those empty strings before the validation runs,
so an optional field that was left empty simply keeps the value it
already had. A field that was set to null is still sent as null, because
null is how a value is cleared.
"""

from typing import Any, Dict

from pydantic import BaseModel, model_validator


class EmptyStringAsNone(BaseModel):
    """
    A model that treats an empty string as "not given".

    Use it as a base class for the request models. It changes nothing
    about the fields themselves: a required field that is empty still
    fails, with the error the user needs to see.

    A field that the model declares as an integer or a decimal is
    emptied to null instead of being dropped. A form that sends
    `category_id: ""` means "no category", and dropping the field
    instead would leave the old category in place.
    """

    @model_validator(mode="before")
    @classmethod
    def _drop_empty_strings(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        # The fields that hold a reference to another record. An empty
        # value there means the reference was cleared.
        reference_fields = {
            "category_id",
            "account_id",
            "to_account_id",
            "from_account_id",
            "allocation_account_id",
            "default_sales_account_id",
            "default_cash_account_id",
            "default_qris_account_id",
            "goal_id",
            "budget_id",
            "recurring_rule_id",
            "transfer_id",
            "merchant_id",
        }

        cleaned: Dict[str, Any] = {}
        for key, value in data.items():
            # Only a plain empty string is dropped. A string with spaces
            # in it is a value the user typed, even if it looks empty.
            if isinstance(value, str) and value.strip() == "":
                if key in reference_fields:
                    cleaned[key] = None
                continue
            cleaned[key] = value

        return cleaned


class EmptyStringAsNoneStrict(EmptyStringAsNone):
    """
    The same, but an empty string becomes null instead of being dropped.

    Use it for the update models, where the user has to be able to clear
    a value. A field that was not in the request at all is still not
    touched.
    """

    @model_validator(mode="before")
    @classmethod
    def _empty_becomes_null(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        cleaned: Dict[str, Any] = {}
        for key, value in data.items():
            if isinstance(value, str) and value.strip() == "":
                cleaned[key] = None
                continue
            cleaned[key] = value

        return cleaned
