define([
  'backbone',
  'vendor/async-storage/async-storage',
  'storage/dbmanager'
], function (Backbone, AsyncStorage, DbManager) {
  'use strict';

  var Message = Backbone.Model.extend({
    idAttribute: '_id',

    defaults: function () {
      return {
        type: 'text',
        meta: {},    // date, commId
        contents: '',
        from: {},  // msisdn
        conversationId: null,
        status: 'pending'
        // _id : autogenerated field which is also the key in storage
      };
    },

    fromRemote: false,

    // Save this message to storage, converting it to the appropriate
    // json format (no from, no meta)
    //
    // callback: function (error, key)
    //    error = null || indexed db error
    //    key = number (value of auto generated _id, or existing _id)
    //
    saveToStorage: function (callback) {
      var _this = this;
      var obj = {};
      if (this.get('_id')) {
        obj._id = this.get('_id'); // otherwise, generate a new one
      }
      obj.type = this.get('type');
      obj.metaType = this.get('meta').type;
      obj.date = this.get('meta') ? this.get('meta').date : new Date();
      obj.date = obj.date ? obj.date : new Date();
      obj.commId = this.get('meta') ? this.get('meta').commId : undefined;
      obj.contents = this.get('contents');
      if (this.get('from') && this.get('from').authorMsisdn) {
        obj.authorMsisdn = this.get('from').authorMsisdn;
      }
      obj.msisdn = this.get('from') ? this.get('from').msisdn : '';
      obj.displayName = this.get('from') ? this.get('from').displayName : '';
      obj.conversationId = this.get('conversationId');
      obj.status = this.get('status');
      DbManager.save({
        store: DbManager.dbMessagesStore,
        value: obj,
        callback: function (error, result) {
          if (!error) {
            console.log('Saved message', result, obj.date.toISOString(),
              obj.msisdn, obj.commId);
            if (!_this.get('_id')) {
              _this.set('_id', result); // remember generated key
            }
          }
          if (callback) { callback(error, result); }
        }
      });
    },

    // Removes this message from storage
    removeFromStorage: function (callback) {
      var id = this.get('_id');
      if (!id) {
        return;
      }
      DbManager.remove({
        key: id,
        store: DbManager.dbMessagesStore,
        callback: function (err) {
          if (err) {
            console.error('Removing message ', id, err);
          } else {
            console.log('Removed message ', id);
          }
          if (callback) { callback(); }
        }
      });
    },

    unregister: function () {
      // Empty for now, but it's being called by the collection's unregister
    },

    getSummary: function () {
      var res = '';
      switch (this.get('type')) {
      case 'text':
        res = this.get('contents');
        break;
      case 'image':
        res = this.get('contents').caption;
        break;
      case 'location':
        res = this.get('contents').address;
        break;
      }
      return res;
    }

  }, {
    // Create a Message from the json saved in database
    // which is slightly different to the json kept in memory (meta, from)
    newFromStorage: function (readJson) {
      var obj = {};
      obj.type = readJson.type;
      obj.meta = { date : readJson.date, commId : readJson.commId,
                   type: readJson.metaType };
      obj.from = { msisdn : readJson.msisdn,
                   displayName : readJson.displayName,
                   authorMsisdn: readJson.authorMsisdn || undefined };
      obj.contents = readJson.contents;
      obj.conversationId = readJson.conversationId;
      obj.status = readJson.status;
      obj._id = readJson._id;
      return new Message(obj);
    },

    // Load a message provided its _id
    loadFromStorage: function (key, callback) {
      DbManager.read({
        store : DbManager.dbMessagesStore,
        value : key,
        loadWithCursor : true,
        callback : function (error, item) {
          if (error || !item || !item.value) {
            callback(null);
          } else {
            callback(Message.newFromStorage(item.value));
          }
        }
      });
    }
  });

  return Message;
});
