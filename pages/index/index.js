//获取应用实例
// import TIM from './tim-wx-sdk'
import {decodeElement} from "../../utils/decodeElement";

const app = getApp()
import { formatTime } from '../../utils/util'
import { genTestUserSig } from '../../sdk/GenerateTestUserSig';


Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    userID: 'lzb', // todo:  上线时候换成userId
    allConversation: [],
    noData: '/static/header.png'
  },

  onLoad: function () {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    } else if (this.data.canIUse){
      // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
      // 所以此处加入 callback 以防止这种情况
      app.userInfoReadyCallback = res => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    } else {
      // 在没有 open-type=getUserInfo 版本的兼容处理
      wx.getUserInfo({
        success: res => {
          app.globalData.userInfo = res.userInfo
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
        }
      })
    }

    this.initListener();
  },
  getUserInfo: function(e) {
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },
  // ---IM START---
  onShow: function() {
    let options = genTestUserSig(this.data.userID);   // 暂时 userID 写死 lzb
    options.runLoopNetType = 0
    if (options) {
      app.tim.login({ userID: this.data.userID, userSig: options.userSig})
      .then(() => {
        console.log('IM 登录成功');
      })
    }
  },
  initListener() {
    const that = this;
    // 登录成功后会触发 SDK_READY 事件，该事件触发后，可正常使用 SDK 接口
    app.tim.on(app.TIM.EVENT.SDK_READY, that.onReadyStateUpdate)
    // SDK NOT READT
    app.tim.on(app.TIM.EVENT.SDK_NOT_READY, that.onReadyStateUpdate)
    // 被踢出
    app.tim.on(app.TIM.EVENT.KICKED_OUT, () => {
      wx.showToast({
        title: '被踢出，请重新登录'
      })
    })
    // SDK内部出错
    app.tim.on(app.TIM.EVENT.ERROR, that.onError)
    // 收到新消息
    app.tim.on(app.TIM.EVENT.MESSAGE_RECEIVED, that.onReceiveMessage)
    // 会话列表更新
    app.tim.on(app.TIM.EVENT.CONVERSATION_LIST_UPDATED, event => {
      // 更新会话列表 凡是不能直接合并原来的会话信息 【数据格式不一致】
      that.updateAllConversation(event.data)
    })
  },
  onReceiveMessage({ data: messageList }) {
    // 会话列表暂时用不到此事件的数据
  },
  onError({ data }) {
    if (data.message !== 'Network Error') {
      // this.$store.commit('showMessage', {
      //   message: data.message,
      //   type: 'error'
      // })
    }
  },
  onReadyStateUpdate({ name }) {
    const that = this;
    const isSDKReady = name === app.TIM.EVENT.SDK_READY ? true : false
    app.globalData.isSDKReady = isSDKReady;
    if (isSDKReady) {
      // todo: 更新登录者的 信息
      // app.tim.updateMyProfile({
      //   nick: '我的昵称',
      //   avatar: '',
      //   gender: app.TIM.TYPES.GENDER_MALE,
      //   selfSignature: '我的个性签名',
      //   allowType: app.TIM.TYPES.ALLOW_TYPE_ALLOW_ANY
      // });
      that.getConversation()
    }
  },

  // 拉取会话列表
  getConversation() {
    const that = this;
    app.tim.getConversationList().then((event) => {
      const list = event.data.conversationList;
      for (let i = 0; i < list.length; i++) {
        let message = list[i]
        let date = new Date(message.lastMessage.lastTime * 1000)
        list[i].newtime = formatTime(date)
      }
      that.setData({
        allConversation: list
      })
    })
  },
  // 更新列表
  updateAllConversation (list) {
    const that = this;
    for (let i = 0; i < list.length; i++) {
      if (list[i].lastMessage && (typeof list[i].lastMessage.lastTime === 'number')) {
        let date = new Date(list[i].lastMessage.lastTime * 1000)
        list[i].newtime = formatTime(date)
      }
    }
    that.setData({
      allConversation: list
    })
  },

  /**
   * go chat.wxml
   */
  linkChat: function(e) {
    // todo: getConversationProfile 此处可以获取会话信息包括会对方的profile
    // todo: 此处也可以把会话设置成已读
    app.tim.setMessageRead({conversationID: e.currentTarget.dataset.conversationId}).then(() => {
      wx.navigateTo({
        url: '/pages/chat/chat?id=' + e.currentTarget.dataset.id
            + '&friendName=' + e.currentTarget.dataset.name
            + '&conversationId=' + e.currentTarget.dataset.conversationId
      })
    });
  },
  onUnload: function() {
    app.tim.logout()
  }
})
