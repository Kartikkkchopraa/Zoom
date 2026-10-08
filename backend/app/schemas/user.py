from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    initials: str
    avatar_color: str


class UserOut(UserBrief):
    email: str
    timezone: str


class UserSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    mute_mic_on_join: bool
    video_off_on_join: bool


class UserUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: Annotated[str, Field(min_length=1, max_length=100)] | None = None


class UserSettingsUpdate(BaseModel):
    mute_mic_on_join: bool | None = None
    video_off_on_join: bool | None = None
