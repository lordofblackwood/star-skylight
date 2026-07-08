import "./shared/device-polyfill";
import { MessageBuilder } from "./shared/message";

App({
  globalData: {
    messageBuilder: null
  },
  onCreate() {
    const appId = hmApp.packageInfo ? hmApp.packageInfo().appId : 1003873;
    this.globalData.messageBuilder = new MessageBuilder({ appId });
    this.globalData.messageBuilder.connect();
  },
  onDestroy() {
    if (this.globalData.messageBuilder) {
      this.globalData.messageBuilder.disConnect();
    }
  }
});
