import { memo } from "react";
import LanguageSetting from "./other/Language";
import SponsorBlock from "./other/SponsorBlock";

const OtherSetting = () => {
  return (
    <>
      <LanguageSetting />
      <br />
      <SponsorBlock />
    </>
  )
}
export default memo(OtherSetting);