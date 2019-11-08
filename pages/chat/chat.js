import {formatTime} from "../../utils/util";
import { decodeElement } from '../../utils/decodeElement'
import {genTestUserSig } from "../../sdk/GenerateTestUserSig";

const app = getApp()
Page({

  /**
   * 页面的初始数据
   */
  data: {
    id: '',
    conversationId: '',
    nextReqMessageID: '', // 下一条消息标志
    isLoading: false,    // 是否正在请求
    isCompleted: false, // 当前会话消息是否已经请求完毕
    messages: [], // 消息集合
    complete: 0,  // 是否还有历史消息可以拉取，1 - 表示没有，0 - 表示有
    content: '',  // 输入框的文本值
    lock: false,  // 发送消息锁 true - 加锁状态 false - 解锁状态
    scroll_height: wx.getSystemInfoSync().windowHeight - 54,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const that = this;
    console.log(options)
    if (!options.id && !options.conversationId) {
      wx.showToast({
        title: 'init错误，请重新链接'
      })
      return;
    }
    if (options.id && options.conversationId) {
      that.setData({
        id: options.id,
        conversationId: options.conversationId
      })
    }
    let idUserSig = genTestUserSig('lzb');   // 暂时 userID 写死 lzb
    idUserSig.runLoopNetType = 0
    app.tim.login({ userID: 'lzb', userSig: idUserSig.userSig})
    .then(() => {
      console.log('IM 登录成功');
    })
    // 此处是从会话列表进来已经 ready 完成了
    if (app.globalData.isSDKReady) {
      that.getMessageList()
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    this.initListener()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

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
    app.tim.on(app.TIM.EVENT.MESSAGE_RECEIVED, (event) => {
      const { id } = that.data
      if (!id) {
        return
      }
      let list = [];
      console.log('received--消息', JSON.stringify(event.data))
      event.data.forEach(item => {
        if (item.conversationID == that.data.conversationId) {
          list.push(item)
        }
      })
      that.receiveMessage(list)
    })
  },
  onError({ data }) {
    if (data.message !== 'Network Error') {
    }
  },
  onReadyStateUpdate({ name }) {
    // 此处是 直接聊天
    const that = this;
    const isSDKReady = name === app.TIM.EVENT.SDK_READY ? true : false
    if (isSDKReady) {
      that.getMessageList();
      // app.tim.getConversationProfile(that.data.conversationId).then((res) => {
      //   console.log('这里是获取会话资料的解耦', res)
      // })
    }
  },
  // 获取消息列表
  getMessageList () {
    const that = this;
    const {id, conversationId,nextReqMessageID, isCompleted, isLoading} = that.data;
    // 判断是否拉完了
    if (!isCompleted) {
      if (!isLoading) {
        that.setData({
          isLoading: true
        })
        console.log('开始拉取消息')
        app.tim.getMessageList({ conversationID: conversationId, nextReqMessageID: nextReqMessageID, count: 15 }).then(res => {
          that.setData({
            nextReqMessageID: res.data.nextReqMessageID
          })
          // 下拉的时候 历史消息列表
          that.unshiftMessageList(res.data.messageList);
         // that.unshiftMessageList()
          if (res.data.isCompleted) {
            that.setData({
              isCompleted: true,
              isLoading: false
            })
            wx.showToast({
              title: '更新成功',
              icon: 'none',
              duration: 1500
            })
          }
        }).catch(err => {
          console.log(err)
        })
      } else {
        wx.showToast({
          title: '你拉的太快了',
          icon: 'none',
          duration: 500
        })
      }
    } else {
      wx.showToast({
        title: '没有更多啦',
        icon: 'none',
        duration: 1500
      })
    }
  },
  // 历史头插消息列表
  unshiftMessageList (messageList) {
    let list = [...messageList]
    for (let i = 0; i < list.length; i++) {
      let message = list[i]
      list[i].virtualDom = decodeElement(message.elements[0])
      let date = new Date(message.time * 1000)
      list[i].newtime = formatTime(date)
    }
    const concatList = [...list, ...this.data.messages];
    this.setData({
      messages: concatList
    })
    this.scrollToBottom()
  },
  // 收到
  receiveMessage (messageList) {
    const that = this;
    let list = [...messageList]
    for (let i = 0; i < list.length; i++) {
      let item = list[i]
      list[i].virtualDom = decodeElement(item.elements[0])
      let date = new Date(item.time * 1000)
      list[i].newtime = formatTime(date)
    }
    that.setData({
      messages:  [...that.data.messages, ...list]
    })
    that.scrollToBottom()
  },

  /**
   * 获取文本的消息
   */
  getContent: function (e) {
    const that = this;
    that.setData({
      content: e.detail.value
    })
  },
  /**
   * 发送消息
   */

  sendMsg: function (e) {
    var that = this
    // 消息锁 锁定中
    if (that.data.lock) {
      wx.showToast({
        title: '发消息太急了，慢一点'
      });
      return
    }
    // 开始加锁
    that.setData({ lock: true })
    if (that.data.content == '' || !that.data.content.replace(/^\s*|\s*$/g, '')) {
      wx.showToast({
        title: '总得填点内容吧'
      });
      this.setData({ lock: false });
      return;
    }
    var content = that.data.content;
    // 调用腾讯IM发送消息
    const message = app.tim.createTextMessage({
      to: that.data.id,
      conversationType: 'C2C',
      payload: { text: content }
    })
    app.tim.sendMessage(message).then((res) => {
      // 解锁
      that.data.messages.push(res.data.message)
      that.setData({
        messages: that.data.messages,
        content: '',
        lock: false,
      })
      that.scrollToBottom()
    })
  },

  // 滚动到到最下面
  scrollToBottom: function () {
    this.setData({
      toView: 'row_' + (this.data.messages.length - 1)
    });
  },


  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    const that = this;
    app.tim.setMessageRead({conversationID: that.data.conversationId}); // 标记成已读信息
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    const that = this;
    app.tim.setMessageRead({conversationID: that.data.conversationId}); // 标记成已读信息
    app.tim.logout()
    this.setData({
      messages: [],  // 清空历史消息
    })
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})