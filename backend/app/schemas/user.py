from pydantic import BaseModel, ConfigDict


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
