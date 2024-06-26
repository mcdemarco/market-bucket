//main.js for Market Bucket by @mcdemarco.
//
// init
// channel
// item
// tags
// search
// list
// user
// ui


var marketBucket = {};

(function(context) { 

	var api = {
		client_id: '7JYXDfqd2AlirYoVR5pbgncOolj18fvu',
		channel_type: 'net.mcdemarco.market-bucket.list',
		annotation_type: 'net.mcdemarco.market-bucket.settings',
		message_annotation_type: 'net.mcdemarco.market-bucket.lists',
		max_samples: 3,
		max_sublists: 4,
		message_count: 200,
		site: 'http://market-bucket.mcdemarco.net'
	};

	var channelArray = {};
	var messageTextArray = {};
	var updateArgs = {include_raw: 1};
	var version = "2.3.1";


context.init = (function () {

	return {
		checkStorage: checkStorage,
		clearPage: clearPage,
		load: load,
		login: login,
		logout: logout,
		refresh: refresh,
		reload: reload,
		reloadChannel: reloadChannel,
		setSortOrder: setSortOrder,
		unsetStorage: unsetStorage
	};

	function checkStorage(key, value) {
		//Defragmented into one function.  Only the channel part needs to be public.
		//We use sessionStorage to decide whether to use currentChannel or reset to last used/defaultChannel.
		//Hopefully if localStorage is there, sessionStorage is too.
		if (key == "currentChannel" && localStorage && localStorage[key]) {
			//The currentChannel may still be in localStorage; if so we move and remove it.
			try {
				api[key] = localStorage[key];
				sessionStorage[key] = api[key];
				unsetStorage(key);
			}
			catch (e) {}
		} else if (key == "currentChannel" && sessionStorage && sessionStorage[key]) {
			//currentChannel moved to sessionStorage, replaced by defaultChannel.
			try {api[key] = sessionStorage[key];}
			catch (e) {}
		} else if (key != "currentChannel" && localStorage && localStorage[key]) {
			try {api[key] = localStorage[key];} 
			catch (e) {}
		} else {
			switch(key) {
				case "accessToken":
					api.accessToken = window.location.hash.split("access_token=")[1];
					if (api.accessToken && localStorage) {
						try {localStorage["accessToken"] = api.accessToken;} 
						catch (e) {}
					}
					break;
				case "currentChannel":
					api.currentChannel = value;
					//It's theoretically ok to store a sample channel as the current channel, 
					//but leaving the restriction in anyway.
					if (sessionStorage && value && !context.channel.isSampleChannel(value)) {
						try {
							sessionStorage["currentChannel"] = value;
						}
						catch (e) {}
					}
					break;
				case "defaultChannel":
					api.defaultChannel = value;
					//Don't store a sample channel; only a real one.
					if (localStorage && value && !context.channel.isSampleChannel(value)) {
						try {
							localStorage["defaultChannel"] = value;
						}
						catch (e) {}
					}
					break;
				case "sortOrder":
					api.sortOrder = value;
					if (localStorage && value) {
						try {localStorage["sortOrder"] = value;}
						catch (e) {}
					}
					break;
				case "userId":
					var promise = $.pnut.user.get("me");
					promise.then(setStorageUser, function (response) {context.ui.failAlert('Failed to retrieve user ID.');});
					break;
				default:
					break;
			}
		}
	}

	function clearPage() {
		//Resets the page for loading a new channel or loading sample channels after logout.
		//Clear the form.
		context.item.clearForm();
		$("div#itemCheckboxes label").hide();
		//Nuke the sublists.
		for (var i=0; i < api.max_sublists; i++) {
			if (i != 1)
				$("#list_" + i).remove();
		}
		//Clear the main list.
		//Assume title will be rewritten, but actively null/rewrite some bits anyway.
		$("#listTitleSPAN").html("");
		$("#list_1 div.formattedItem").remove();
		$("#list_1 span.subTitle").html("");
		$("#list_1").removeClass("col-sm-offset-2").addClass("col-sm-offset-4");
		$(".tagBucket").html("");
		//Clear the relevant settings.
		$("div#memberResults").html("");
		$("div#searchResults").html("");
		//Clear the list controls.
		$("div#listGroupNameWrapper").html("");
		$("div#sublistControl").html("");
		//Clear search form field.
		$("input#textSearchField").val("");
		//...
	}

	function load() {
		//The initialization function called on document ready.
		$("a.h1-link").attr('href',api.site);
		$("a#fontBrandLink").click(function(){context.ui.navbarSetter();});
		activateButtons();
		$("#version").html(version);

		checkStorage("accessToken");
		if (!api.accessToken) {
			logout();
			return;
		}
		$.pnut.authorize(api.accessToken,api.client_id);
		if (!$.pnut.token.get()) {
			logout();
			return;
		} else {
			context.ui.pushHistory(api.site);
			$(".loggedOut").hide();
			checkStorage("defaultChannel");
			//If there's a default channel, it will get selected, so set UI to match.
			if (api.defaultChannel)
				context.ui.defaultToggle();
			context.channel.get();
			$(".loggedIn").show('slow');
			checkStorage("userId");
			checkStorage("sortOrder");
			if (api.sortOrder) {
				context.ui.displaySortOrder(api.sortOrder);
			}
		}
	}

	function login() {
		var authUrl = "https://pnut.io/oauth/authenticate?client_id=" + api['client_id'] + "&response_type=token&scope=messages:" + api.channel_type + "&redirect_uri=" + encodeURIComponent(api.site);
		window.location = authUrl;
	}

	function logout() {
		//Erase token and lists.
		api.accessToken = '';
		api.currentChannel = '0';
		if (localStorage) {
			try {
				localStorage.clear();
			} catch (e) {}
		}
		
		$(".loggedIn").hide();
		$(".loggedOut").show();
		//Clear the lists.
		clearPage();
		//Reset the channel array by processing the sample channel?
		context.channel.useSampleChannel();
	}

	function refresh(e) {
		//Manual refresh button.
		context.search.unfilter(e);
		context.channel.getCurrent();
	}

	function reload(e) {
		//Reload helper for UI list dropdown.
		var newChannelId = $(e.target).val();
		reloadChannel(newChannelId);
	}

	function reloadChannel(newChannelId, force) {
		//Reloader for all channel changes (UI, on create, etc.).
		if (!force && api.currentChannel == newChannelId) 
			return;
		if (!channelArray.hasOwnProperty(newChannelId)) {
			context.ui.failAlert("Failed to change the channel.");
			return;
		}
		//Now we're ready to restore to an initializable state.
		clearPage();
		//sample checking done by this function for itself
		setStorage("currentChannel",newChannelId);
		context.channel.display(newChannelId);
		context.ui.forceScroll("#sectionLists");
	}

	function setSortOrder(order) {
		setStorage("sortOrder", order);
		reloadChannel(api.currentChannel, true);
		context.ui.displaySortOrder(order);
	}

	function unsetStorage(key) {
		//Only for localStorage.
		if (localStorage && localStorage.hasOwnProperty(key)) {
			try {localStorage.removeItem(key);}
			catch (e) {}
		}
	}

	//private
	function activateButtons() {
		//Activates all buttons on the page as initially loaded.
		$("#addButton").click(context.item.add);
		$("#addMemberButton").click(context.ui.addMember);
		$("#clearButton").click(context.item.clearForm);
		$("#createButton").click(context.list.add);
		$("#list_1 span[data-type='addButton']").click(context.ui.add);
		$("#listRefreshButton").click(context.init.refresh);
		$("#listSetSelect").change(context.init.reload);
		$("#logInButton").click(context.init.login);
		$("#logOutButton").click(context.init.logout);
		$("div#controlButtons a.controlButton").click(context.ui.controlToggle);
		$("span#defaultToggle").click(context.list.defaultToggle);
		$("#saveListEdits").click(context.list.edit);
		$("#searchUsers").click(context.user.search);
		$("#searchClearButton").click(context.search.unfilter);
		$("#textSearchButton").click(context.search.filter);

		//Stuff we need to be .live.
		$("#sectionLists").on("click","span.collapseButton",context.ui.collapseArchive);
		$("#sectionLists").on("click","span.uncollapseButton",context.ui.uncollapseArchive);
		$("#sectionLists").on("click","div.formattedItem",context.item.settingsToggle);
		$("#sectionLists").on("click","div.formattedItem button[data-button='moveItem']",context.item.move);
		$("#sectionLists").on("click","div.formattedItem a[data-button='moveItem']",context.item.move);
		$("#sectionLists").on("click","div.formattedItem button[data-button='deleteItem']",context.item.deleteIt);
		$("#sectionLists").on("click","div.formattedItem a[data-button='deleteItem']",context.item.deleteIt);
		$("#sectionLists").on("click","div.formattedItem a[data-button='editItem']",context.item.edit);

		//save settings?

		//Not buttons
		$("#bucketSorterWrapper input[type=radio]").click(context.ui.sortLists);

		$("#textSearchField").on('keyup', function (e) {
			if (e.key === 'Enter' || e.keyCode === 13) {
        context.search.filter();
			}
		});
	}

	function setStorage(key, value) {
		//Explicit setter for local storage, which is normally set during a check.
		api[key] = value;
		if (localStorage) {
			if (key == "currentChannel") {
				if (context.channel.isSampleChannel(value)) {
					//Don't store the demo channel (see checkStorage for details).
					return;
				} else {
					//Now stored in sessionStorage, not localStorage.
					try {sessionStorage[key] = value;}
					catch (e) {}
				}
			}
			//Else store the new value in localStorage.
			try {localStorage[key] = value;}
			catch (e) {}
		}
	}

	function setStorageUser(response) {
		//Callback for the local user query.
		api.userId = response.data.id;
		if (api.userId && localStorage) {
			try {localStorage["userId"] = api.userId;} 
			catch (e) {}
		}
	}

})();

context.channel = (function () {

	return {
		display: display,
		get: get,
		getAnnotations: getAnnotations,
		getCurrent: getCurrent,
		isSampleChannel: isSampleChannel,
		storeChannel: storeChannel,
		useSampleChannel: useSampleChannel
	};

	function get() {
		//Determine channels and hand them off.
		var args = {
			include_raw: 1,
			include_inactive: 0,
			order: 'activity',
			type: api.channel_type
		};
		var promise = $.pnut.channel.getUserSubscribed(args);
		promise.then(completeChannelSearch, function (response) {context.ui.failAlert('Failed to retrieve your list(s).');}).done(context.tags.colorize);
	}

	function getAnnotations(thisChannel) {
		//Annotations processor; public because needed for item processing.
		//Not assuming we're the only annotation.
		var ourAnnotations = {};
		for (var a = 0; a < thisChannel.raw.length; a++) {
			if (thisChannel.raw[a].type == api.annotation_type) {
				ourAnnotations[api.annotation_type] = thisChannel.raw[a].value;
			}
			if (thisChannel.raw[a].type == api.message_annotation_type) {
				ourAnnotations[api.message_annotation_type] = thisChannel.raw[a].value;
			}
		}
		return ourAnnotations;
	}

	function getCurrent() {
		//A better process for refreshing the current channel.
		var args = {
			include_raw: 1
		};
		var promise = $.pnut.channel.get(api.currentChannel,args);
		promise.then(completeChannel, function (response) {context.ui.failAlert('Failed to retrieve your list(s).');}); //.done(context.channel.display);
	}

	function isSampleChannel(channelId) {
		//Canned channel checker.
		if (!channelId)
			channelId = api.currentChannel;
		return (parseInt(channelId) <= api.max_samples);
	}

	function storeChannel(thisChannel, annotationsObject) {
		//Just populating some old arguments instead of refactoring.
		var annotationValue = annotationsObject[api.annotation_type];
		var messageAnnotationValue = annotationsObject.hasOwnProperty(api.message_annotation_type) ? annotationsObject[api.message_annotation_type]: {};
		//Save data for every channel.
		channelArray[thisChannel.id] = {
			"id" : thisChannel.id,
			"name" : annotationValue["name"],
			"owner" : thisChannel.owner,
			"editors" : thisChannel.acl,
			"editorIds" : thisChannel.acl.full.user_ids,
			"oldEditorIds" : thisChannel.acl.write.user_ids,
			"tagArray" : []
		};
		if (annotationValue.hasOwnProperty("list_types")) {
			channelArray[thisChannel.id].listTypes = annotationValue.list_types;
			channelArray[thisChannel.id].lists = messageAnnotationValue.lists ?  messageAnnotationValue.lists : {};
		}
		if (channelArray[thisChannel.id].oldEditorIds.length > 0 && thisChannel.owner.id == api.userId) {
			context.user.fix(thisChannel.id);
		}
	}

	function useSampleChannel() {
		//Indicate the sample channel and data by low channel ids.
		var sampleChannelResponse = getSampleChannelResponse();
		//var sampleMessages = getSampleMessages();
		completeChannelSearch(sampleChannelResponse);
		//context.tags.display();
	}

	//private
	function getSampleChannelResponse() {
		//Needed to put the sample channel search canned response in a function instead of a variable.
		var sampleChannelResponse = {"data": [
			{"pagination_id":"10000",
	     "is_inactive":false,
			 "acl": {
				 "full":{"immutable":false,
								 "you":true,
								 "user_ids":[]},
	       "read":{"public":false,
	               "user_ids":[],
	               "any_user":false,
	               "you":true,
	               "immutable":false},
	       "write":{"public":false,
	                "user_ids":[],
	                "any_user":false,
	                "you":true,
	                "immutable":false}
			 },
	     "you_muted":false,
	     "you_can_edit":true,
	     "has_unread":true,
	     "editors":{"public":false,
	                "user_ids":[],
	                "any_user":false,
	                "you":true,
	                "immutable":false},
	     "raw":[{"type":"net.mcdemarco.market-bucket.lists",
	             "value":{"lists":{"0":["5080161","5080161","5080170","5080170","5080177","5080177"],
																 "2":["5080128","5080148","5080160"]}}},
	            {"type":"net.mcdemarco.market-bucket.settings",
	             "value":{"list_types":{"0":{"title":"archive"},
	                                    "1":{"title":"now"},
	                                    "2":{"title":"later"}},
	                      "name":"Check It Twice"}}],
	     "recent_message_id":"5080177",
	     "you_subscribed":true,
	     "owner":{"username":"example_user",
	              "content": {"avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png",
																						"width":144,
																						"is_default":false,
																						"height":144},
														"description":{"text":"",
																					 "entities":{"mentions":[],
																											 "hashtags":[],
																											 "links":[]}},
														"verified_link":"http://mcdemarco.net",
														"locale":"en_US",
														"created_at":"2013-04-06T12:31:18Z",
														"id":"68560",
														"canonical_url":"https://pnut.io/@mcdemarco",
														"verified_domain":"mcdemarco.net",
														"cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg",
																					 "width":1024,
																					 "is_default":false,
																					 "height":683},
														"timezone":"America/New_York"
													 },
	                  "counts":{"following":120,
	                            "posts":2429,
	                            "followers":95,
	                            "stars":346},
	                  "type":"human",
	                  "raw":[],
	                  "name":"M. C. DeMarco"},
	         "counts":{"messages":14},
	         "type":"net.mcdemarco.market-bucket.list",
	         "id":"0"},
			{"pagination_id":"10000",
			 "is_inactive":false,
			 "acl": {
				 "full":{"immutable":false,
								 "you":true,
								 "user_ids":[]},
				 "read":{"public":false,
								 "user_ids":[],
								 "any_user":false,
								 "you":true,
								 "immutable":false},
				 "write":{"public":false,
										"user_ids":[],
										"any_user":false,
										"you":true,
										"immutable":false}
			 },
			 "you_muted":false,
			 "you_can_edit":true,
			 "has_unread":true,
			 "editors":{"public":false,
						"user_ids":[],
						"any_user":false,
						"you":true,
						"immutable":false},
			 "raw":[{"type":"net.mcdemarco.market-bucket.settings",
							 "value":{"name":"Bucket List"}}],
			 "recent_message_id":"5091227",
			 "you_subscribed":true,
			 "owner":{"username":"example_user",
					  "avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png",
									  "width":144,
									  "is_default":false,
									  "height":144},
					  "description":{"text":"",
									 "html":"",
									 "entities":{"mentions":[],
												 "hashtags":[],
												 "links":[]}},
					  "verified_link":"http://mcdemarco.net",
					  "locale":"en_US",
					  "created_at":"2013-04-06T12:31:18Z",
					  "id":"68560",
					  "canonical_url":"https://pnut.io/@mcdemarco",
					  "verified_domain":"mcdemarco.net",
					  "cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg",
									 "width":1024,
									 "is_default":false,
									 "height":683},
					  "timezone":"America/New_York",
					  "counts":{"following":120,
								"posts":2449,
								"followers":96,
								"stars":347},
					  "type":"human",
					  "raw":[],
					  "name":"M. C. DeMarco"},
			 "counts":{"messages":3},
			 "type":"net.mcdemarco.market-bucket.list",
			 "id":"1"}
		]};
		return sampleChannelResponse;
	}

	function getSampleMessages() {
		//Needed to put the sample message retrieval canned response in a function instead of a variable.
		var sampleMessages = {"0":{"data":[
				{"num_replies":0,"channel_id":"0","content":{"text":"olive oil","entities":{"mentions":[],"tags":[],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">olive oil</span>"},"id":"5080177","created_at":"2014-10-13T20:36:56Z","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5080177","pagination_id":"5080177","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2429,"followers":95,"stars":346},"type":"human","id":"68560","name":"M. C. DeMarco"}},
				{"num_replies":0,"channel_id":"0","content":{"text":"coconut oil","entities":{"mentions":[],"tags":[],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">coconut oil</span>"},"created_at":"2014-10-13T20:36:34Z","id":"5080170","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5080170","pagination_id":"5080170","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2429,"followers":95,"stars":346},"type":"human","id":"68560","name":"M. C. DeMarco"}},
				{"num_replies":0,"channel_id":"0","content":{"text":"chicken thighs #perishable","entities":{"mentions":[],"tags":[{"text":"perishable","len":11,"pos":15}],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">chicken thighs <span data-tag-name=\"perishable\" itemprop=\"tag\">#perishable</span></span>"},"created_at":"2014-10-13T20:35:49Z","id":"5080161","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5080161","pagination_id":"5080161","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2429,"followers":95,"stars":346},"type":"human","id":"68560","name":"M. C. DeMarco"}},
				{"num_replies":0,"channel_id":"0","content":{"text":"batteries #RadioShack","entities":{"mentions":[],"tags":[{"text":"radioshack","len":11,"pos":10}],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">batteries <span data-tag-name=\"radioshack\" itemprop=\"tag\">#RadioShack</span></span>"},"created_at":"2014-10-13T20:35:08Z","id":"5080160","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5080160","pagination_id":"5080160","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2429,"followers":95,"stars":346},"type":"human","id":"68560","name":"M. C. DeMarco"}},
				{"num_replies":0,"channel_id":"0","content":{"text":"creamer","entities":{"mentions":[],"tags":[],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">creamer</span>"},"created_at":"2014-10-13T20:34:56Z","id":"5080148","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5080148","pagination_id":"5080148","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2429,"followers":95,"stars":346},"type":"human","id":"68560","name":"M. C. DeMarco"}},
				{"num_replies":0,"channel_id":"0","content":{"text":"kitrone","entities":{"mentions":[],"tags":[],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">kitrone</span>"},"created_at":"2014-10-13T20:33:18Z","id":"5080128","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5080128","pagination_id":"5080128","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2429,"followers":95,"stars":346},"type":"human","id":"68560","name":"M. C. DeMarco"}},
				{"num_replies":0,"channel_id":"0","content":{"text":"Twinkies™","entities":{"mentions":[],"tags":[],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">Twinkies&#8482;</span>"},"created_at":"2014-10-13T20:27:39Z","id":"5080100","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5080100","pagination_id":"5080100","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2429,"followers":95,"stars":346},"type":"human","id":"68560","name":"M. C. DeMarco"}},
				{"num_replies":0,"channel_id":"0","content":{"text":"panko from #TraderJoes","entities":{"mentions":[],"tags":[{"text":"traderjoes","len":11,"pos":11}],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">panko from <span data-tag-name=\"traderjoes\" itemprop=\"tag\">#TraderJoes</span></span>"},"created_at":"2014-10-13T20:25:49Z","id":"5080091","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5080091","pagination_id":"5080091","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2429,"followers":95,"stars":346},"type":"human","id":"68560","name":"M. C. DeMarco"}},
				{"num_replies":0,"channel_id":"0","content":{"text":"milk  #perishable","entities":{"mentions":[],"tags":[{"text":"perishable","len":11,"pos":6}],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">milk  <span data-tag-name=\"perishable\" itemprop=\"tag\">#perishable</span></span>"},"created_at":"2014-10-13T20:25:07Z","id":"5080090","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5080090","pagination_id":"5080090","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2429,"followers":95,"stars":346},"type":"human","id":"68560","name":"M. C. DeMarco"}},
				{"num_replies":0,"channel_id":"0","content":{"text":"eggs from #MarketBasket","entities":{"mentions":[],"tags":[{"text":"marketbasket","len":13,"pos":10}],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">eggs from <span data-tag-name=\"marketbasket\" itemprop=\"tag\">#MarketBasket</span></span>"},"created_at":"2014-10-13T20:24:49Z","id":"5080089","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5080089","pagination_id":"5080089","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2429,"followers":95,"stars":346},"type":"human","id":"68560","name":"M. C. DeMarco"}},
				{"num_replies":0,"channel_id":"0","content":{"text":"circuses","entities":{"mentions":[],"tags":[],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">circuses</span>"},"created_at":"2014-10-13T20:15:19Z","id":"5080015","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5080015","pagination_id":"5080015","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2429,"followers":95,"stars":346},"type":"human","id":"68560","name":"M. C. DeMarco"}},
				{"num_replies":0,"channel_id":"0","content":{"text":"bread","entities":{"mentions":[],"tags":[],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">bread</span>"},"created_at":"2014-10-13T20:15:09Z","id":"5080013","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5080013","pagination_id":"5080013","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2429,"followers":95,"stars":346},"type":"human","id":"68560","name":"M. C. DeMarco"}}
			]},
			"1":{"data":[
				{"num_replies":0,"channel_id":"1","content":{"text":"Create my own Market Bucket list.","entities":{"mentions":[],"tags":[],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">Create my own Market Bucket list.</span>"},"created_at":"2014-10-15T01:49:46Z","id":"5091227","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5091227","pagination_id":"5091227","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2449,"followers":96,"stars":347},"type":"human","id":"68560","name":"M. C. DeMarco"}},
				{"num_replies":0,"channel_id":"1","content":{"text":"Cure Ebola.","entities":{"mentions":[],"tags":[],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">Cure Ebola.</span>"},"created_at":"2014-10-15T01:49:12Z","id":"5091226","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5091226","pagination_id":"5091226","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2449,"followers":96,"stars":347},"type":"human","id":"68560","name":"M. C. DeMarco"}},
				{"num_replies":0,"channel_id":"1","content":{"text":"Sell seashells by the seashore.","entities":{"mentions":[],"tags":[],"links":[]},"html":"<span itemscope=\"https://app.net/schemas/Post\">Sell seashells by the seashore.</span>"},"created_at":"2014-10-14T17:27:38Z","id":"5088189","machine_only":false,"source":{"link":"http://market-bucket.mcdemarco.net","name":"Market Bucket","client_id":"hzt2h6g8uGeXtwjKq8VgKmj8u3sztKtr"},"thread_id":"5088189","pagination_id":"5088189","user":{"username":"example_user","avatar_image":{"link":"http://market-bucket.mcdemarco.net/images/apple-touch-icon-144x144.png","width":144,"is_default":false,"height":144},"description":{"text":"","html":"","entities":{"mentions":[],"tags":[],"links":[]}},"verified_link":"http://mcdemarco.net","locale":"en_US","created_at":"2013-04-06T12:31:18Z","canonical_url":"https://pnut.io/@mcdemarco","verified_domain":"mcdemarco.net","cover_image":{"link":"http://market-bucket.mcdemarco.net/images/good-food-1024-background.jpg","width":1024,"is_default":false,"height":683},"timezone":"America/New_York","counts":{"following":120,"posts":2449,"followers":96,"stars":347},"type":"human","id":"68560","name":"M. C. DeMarco"}}
			]}
		};
		return sampleMessages;
	}

	function completeChannel(response) {
		//Like completeChannelSearch but for a single channel.
		if (response.data) {
			context.init.clearPage();
			populateChannel(response.data);
		}
	}

	function completeChannelSearch(response) {
		//Process the automatic channel search's results.
		if (response.data.length == 0) {
			//If no results, use the sample response.
			response = getSampleChannelResponse();
		}
		if (response.data.length > 0) {
			for (var c = 0; c < response.data.length; c++) {
				populateChannel(response.data[c]);
			}
			populateChannelSelector();
		}
	}

	function populateChannel(thisChannel) {
		//Populates the channel array and passes the selected channel on.
		var annotations = getAnnotations(thisChannel);
		//Eject if no settings annotation.
		if (!annotations.hasOwnProperty(api.annotation_type)) 
			return;
		
		storeChannel(thisChannel, annotations);

		/*Warn if user can't write to channel.
		if (channelArray[thisChannel.id].owner.id != api.userId 
				&& channelArray[thisChannel.id].editorIds.indexOf(api.userId) < 0)
			context.ui.failAlert("You won't be able to move items in the '" + channelArray[thisChannel.id].name + "' list until the owner logs into Market Bucket again.");
		*/

		if (Object.keys(channelArray).length == 1) {
			//This channel is first in the activity ordering and will be our default if one wasn't saved.
			context.init.checkStorage("currentChannel",api.defaultChannel ? api.defaultChannel : thisChannel.id);
		}

		//Fetch more data if this is the right channel.
		if (api.currentChannel && api.currentChannel == thisChannel.id) {
			display(thisChannel.id);
		}
	}

	function populateChannelSelector() {
		//Put the channel list into the settings dropdown.
		for (var ch in channelArray) {
			if (channelArray.hasOwnProperty(ch)) {
				var optionString = "<option id='channel_" + ch + "' value='" + ch + "'" + ((ch == api.currentChannel) ? " selected" : "") + ">" + channelArray[ch].name + (isSampleChannel() ? " (demo list)" : "")  + "</option>";
				$("select#listSetSelect").append(optionString);
			}
		} 
	}

	function display(thisChannelId) {
		//Display a channel based on the stored info in channelArray, and retrieve messages or use canned messages.
		//Users in settings panel.
		var listTypes = (channelArray[thisChannelId] && channelArray[thisChannelId].hasOwnProperty("listTypes") ? channelArray[thisChannelId].listTypes : {});
		processChannelUsers(thisChannelId);
		
		context.ui.nameList(thisChannelId);
		
		//Make more list holders for sublists.
		var len = Object.keys(listTypes).length;
		if (len > 0) {
			//Editor for first list name.
			editCloner(1, listTypes);
			
			for (var i = 2; i <= len; i++) {
				if (listTypes.hasOwnProperty(i.toString())) {
					listCloner(i, listTypes);
				}
			}
			if (listTypes.hasOwnProperty("0")) {
				listCloner(0, listTypes);
			}
			//Need to retitle the main list.
			context.ui.nameSublist(1, listTypes);
			
			//Layout adjustment for the big screen.
			$("div#list_1").removeClass("col-sm-offset-4");
			if (len == 2) 
				$("div#list_1").addClass("col-sm-offset-2");
			if (len == 4) 
				$("div#list_0").addClass("col-sm-offset-4");
		}
		displayMessages(thisChannelId);
	}
		
	function displayMessages(thisChannelId) {
		if (isSampleChannel(thisChannelId)) {
			//Use sample messages.
			var theseMessages = getSampleMessages();
			completeMessages(theseMessages[thisChannelId]);
			context.tags.display();
		} else {
			//Retrieve the messages from ADN.
			var args = {
				include_deleted: 0,
				include_raw: 1,
				count: api.message_count
			};
			var promise = $.pnut.message.getChannel(thisChannelId, args);
			promise.then(function(response) {completeMessagesCheck(response,[]);}, function (response) {context.ui.failAlert('Failed to retrieve items.');});//.done(context.tags.display,context.ui.collapseArchive);
		}
	}
	
	function listCloner(index, listTypesObj) {
		//Clone and name new list wrappers.
		$("div#list_1").clone().attr("id","list_" + index).data("type",index).appendTo("div#bucketListHolder").removeClass("col-sm-offset-4");
		context.ui.nameSublist(index, listTypesObj);
		//Activate new buttons.
		$("div#list_" + index + " span[data-type='addButton']").click(context.ui.add);
		editCloner(index, listTypesObj);
	}
		
	function editCloner(index, listTypesObj) {
		//Add a list and sublist control for the current list, if appropriate.
		$("#sublistControl").append("<div class='form-group listControl' id='sublist_" + index + "'><div class='col-xs-4 text-right'><label class='control-label' for='sublistEdit_" + index + "'>" + (index == 0 ? "Archive" : "List " + index) + ":</label></div><div class='col-xs-3'><input type='text' id='sublistEdit_" + index + "' name='title' class='form-control listTitle' value='" + listTypesObj[index.toString()].title + "' /></div><div class='col-xs-4'><input type='text' id='sublistSubtitle_" + index + "' name='subtitle' class='form-control' value='" + (listTypesObj[index.toString()].subtitle ? listTypesObj[index.toString()].subtitle : "") + "' placeholder='Optional subtitle' /></div></div>");
	}

	function completeMessagesCheck(response, data) {
		//Handle the current response.
		if (response.data.length > 0) {
			if (data) {
				//Append new data.
				data = data.concat(JSON.parse(JSON.stringify(response.data)));
			} else {
				//Initialize.
				data = JSON.parse(JSON.stringify(response.data));
			}
		} else {
			//There wasn't more?  There was nothing at all?
			if (!data)
				data = [];
		}
		//Check for more.
		if (response.meta && response.meta.more == true) {
			var args = {
				include_deleted: 0,
				include_raw: 1,
				count: api.message_count,
				before_id: response.meta.min_id
			};
			var thisChannelId = data[0].channel_id;
			var subpromise = $.pnut.message.getChannel(thisChannelId, args);
			subpromise.then(function(subresponse) {completeMessagesCheck(subresponse, data)}, function (response) {context.ui.failAlert('Failed to retrieve additional items.');}); //.done(context.tags.display,context.ui.collapseArchive);
		} else {
			//No more, so finish up.
			completeMessages(data);
		}
		
	}

	function completeMessages(data) {
		//Populate the UI for an individual retrieved message list.
		if (data.length > 0) {
			switch (api.sortOrder) {
				case "az":
				data.sort(azChannelSorter);
				break;

				case "on":
				data.sort(oldNewChannelSorter);
				break;

				case "no":
				case undefined:
				break;
			}

			for (var i=0; i < data.length; i++) {
				var respd = data[i];
				context.item.format(respd);
				context.tags.collect(respd.content.entities.tags,respd.channel_id);
			}
			context.tags.display();
			context.ui.collapseArchive();
		}
	}

	function processChannelUsers(thisChannelId) {
		//Put the users into member control.
		var thisChannel = channelArray[thisChannelId];
		//Owner not included in the editors list, so add separately.
		context.user.display(thisChannel.owner, "owner");
		//User data.
		if (thisChannel.editors.full.user_ids.length > 0) {
			//Retrieve the user data.
			var promise = $.pnut.user.getList(thisChannel.editors.full.user_ids);
			promise.then(completeUsers, function (response) {context.ui.failAlert('Failed to retrieve users.');});
		}
		//Ownership hath its privileges.
		if (thisChannel.owner.id != api.userId) {
			//Only the add member button so far.  Deleting the list would qualify.
			$(".listOwner").hide();
		} else {
			//For list switching.
			$("form#settingsForm a.btn").show();
			$(".listOwner").show();
		}
	}

	function completeUsers(response) {
		//Handle the editor query response data.
		for (u=0; u < response.data.length; u++) {
			context.user.display(response.data[u],"editor");
		}
	}

	function azChannelSorter(a,b) {
		try {
			return a.content.text.localeCompare(b.content.text, 'en', {sensitivity: 'base'});
		} catch(e) {
			//This is case sensitive.
			return a.content.text.localeCompare(b.content.text);
		}
	}

	function oldNewChannelSorter(a,b) {
		return a.id - b.id;
	}

	function newOldChannelSorter(a,b) {
		//For future use.  This is the order the data is coming from the server, so don't actually need to sort it.
		return b.id - a.id;
	}

})();

context.item = (function () {

	return {
		add: add,
		clearForm: clearForm,
		deleteIt: deleteIt,
		edit: edit,
		format: format,
		move: move,
		settingsToggle: settingsToggle
	};

	//public
	function add() {
		//Adds an item.
		var channelId = api.currentChannel;
		var message = $("textarea#item").val();
		if (message == "") {
			alert("No item text entered.");
			return;
		}
		//The edit case.
		if ($("#editItemId").val() != "") {
			if (message == messageTextArray) {
				alert("Message was not changed.");
				return;
			} else {
				deleteItem($("#editItemId").val());
				//There's a clearForm() later on, but do this to be extra safe:
				$("#editItemId").val("");
			}
		}
		//Don't want the new buttons starting out of sync.
		var listType = $("input[name=bucketBucket]:checked").data("list");
		context.ui.settingsOff();
		createItem(channelId, message);
	}

	function clearForm() {
		//Clear the add item form.
		$("textarea#item").val("");
		$("button#addButton").html("Add Item");
		$("#editItemId").val("");
	}

	function deleteIt(e) {
		//Handle the UI call to delete an item.
		var itemId = $(e.target).closest("div.formattedItem").data("itemid");
		deleteItem(itemId);
	}

	function edit(e) {
		//Handle the UI call to edit an item.
		var itemId = $(e.target).closest("div.formattedItem").data("itemid");
		console.log(itemId);
		editItem(itemId);
	}

	function format(respd, sublist) {
		//Format an individual item.
		//Default (sub)list.
		var listType = (typeof sublist !== 'undefined' ? sublist : 1);
		//Check for alternate sublist IF the list has official sublists and it wasn't passed in.
		if (typeof sublist === 'undefined' && channelArray[respd.channel_id].hasOwnProperty("listTypes")) {
			for (var key in channelArray[respd.channel_id].listTypes) {
				if (channelArray[respd.channel_id].listTypes.hasOwnProperty(key) && 
					channelArray[respd.channel_id].lists.hasOwnProperty(key) &&
					channelArray[respd.channel_id].lists[key].indexOf(respd.id) > -1) {
					listType = key;
				}
			}
		}
		
		var itemDate = new Date(respd.created_at);
		var formattedItem = "<div class='list-group-item clearfix formattedItem' id='item_" + respd.id + "'";
		formattedItem += " data-itemid='" + respd.id + "' data-creator='" + respd.user.id + "'>";
		formattedItem += "<span class='list-group-item-text' title='Added " + itemDate.toLocaleString() + " by " + respd.user.username + "'>";
		formattedItem += respd.content.html + "</span>";
		formattedItem += formatButtons(respd.id, respd.channel_id, listType);
		formattedItem += "</div>";
		//Append the item.
		$("#list_" + listType + " div.list-group").append(formattedItem);
		//Pre-format the hashtags.
		$("#item_" + respd.id + " span[itemprop='tag']").each(function(index) {
			if (!$(this).hasClass("tag")) {
				$(this).addClass("tag").css("padding","1px 3px").css("border-radius","3px");
			}
			$(this).click(function(event) {
				event.preventDefault();
				context.ui.itemTag($(this).data("hashtagName"));
			});
		});
		//Store the item.
		messageTextArray[respd.id] = respd.content.text;
	}

	function move(e) {
		//Handle the UI call to move an item.
		var itemId = $(e.target).closest("div.formattedItem").data("itemid");
		var targetType = $(e.target).closest("[data-destination]").data("destination");
		moveItem(itemId, targetType);
	}

	function settingsToggle(e) {
		//Handle the ellipsis (formerly settings) buttons on items (formerly sublist-wide).
		if ($(e.target).closest("button").length > 0)
			return;
		e.preventDefault();
		$(e.target).closest("div.formattedItem").find(".settingsToggle").toggle();
	}
	
	//private

	function createItem(channel,message) {
		//Creates all new items, including edited ones.
		if (!channel) {
			context.ui.failAlert('Failed to create item.');
			return;
		}
		if (context.channel.isSampleChannel(channel)) {
			context.ui.failAlert('Add and edit are disabled for sample lists.');
			return;
		}
		var newMessage = {
			text: message
		};
		var promise = $.pnut.message.create(channel, newMessage);
		promise.then(completeItem, function (response) {context.ui.failAlert('Failed to create item.');});
	}
	
	function completeItem(response) {
		//Handle item creation response.
		var respd = response.data;
		
		if (channelArray[response.data.channel_id].hasOwnProperty("listTypes")) {
			var listType = $("input[name=bucketBucket]:checked").data("list");
			format(respd,listType);
			if (listType != 1) {
				//Update the sublists!
				updateSublistOnAdd(respd.channel_id,respd.id, listType);
			}
		} else {
			format(respd);
		}
		context.tags.colorize(respd.id);
		clearForm();
		context.ui.forceScroll("#sectionLists");
	}

	function deleteItem(itemId) {
		//On active delete, check for ownership and delete if owned or add to queue if not.
		var currentChannel = api.currentChannel;
		if (!context.channel.isSampleChannel(currentChannel)) {
			var promise = $.pnut.message.destroy(currentChannel,itemId);
			promise.then(completeDelete,  function (response) {context.ui.failAlert('Failed to delete item.');});
		}
		//Remove item from UI.
		$("#item_" + itemId).remove();
	}

	function editItem(itemId) {
		//Populate the form with the stored data, change the buttons, and scroll to it.
		$("textarea#item").val(messageTextArray[itemId]);
		var listType = $("#item_" + itemId).closest("div.bucketListDiv").data("type");
		$("input:radio[name=bucketBucket][data-list=" + listType + "]").prop('checked', true);
		$("button#addButton").html("Save Edits");
		$("#editItemId").val(itemId.toString());
		context.ui.forceScroll("#sectionAdd");
	}

	function moveItem(itemId, targetType) {
		//Move items, including for archiving.
		var currentChannel = api.currentChannel;
		if (!context.channel.isSampleChannel(currentChannel)) { 
			var sourceType = $("#item_" + itemId).closest("div.bucketListDiv").data("type");
			var updatedLists = JSON.parse(JSON.stringify(channelArray[currentChannel].lists));
			//Movement paths: from default to non-default, from non-default to non-default, from non-default to default.
			if (sourceType != 1) {
				//need to debit the source list.
				var index = updatedLists[sourceType].indexOf(itemId.toString());
				if (index > -1) updatedLists[sourceType].splice(index, 1);
			}
			if (targetType != 1) {
				//need to credit the target list
				if (updatedLists[targetType])
					updatedLists[targetType].push(itemId.toString());
				else
					updatedLists[targetType] = [itemId.toString()];
			}
			//Send to pnut.
			updateLists(currentChannel,updatedLists);
		}
		//Move html.
		$("#item_" + itemId).appendTo("div#list_" + targetType + " div.list-group");
		//Need to update the buttons.
		$("div#buttons_" + itemId).remove();
		//Don't worry about the new buttons starting out of sync b/c this fix caused issues.
		context.ui.settingsOff();
		$("#item_" + itemId).append(formatButtons(itemId,currentChannel,targetType));
	}

	function formatButtons(itemId, channelId, listType) {
		//Add the appropriate buttons to a formatted list item.
		if (!channelId) channelId = api.currentChannel;
		var formattedItem = "<div id='buttons_" + itemId + "' class='pull-right'>";
		var defaultDestList;
		if (channelArray[channelId].hasOwnProperty("listTypes")) {
			var len = Object.keys(channelArray[channelId].listTypes).length;
			if (len > 1)
				defaultDestList = (len-1).toString();
		}
		if (listType != "0") {
			if (listType != "1") {
				//Add a move up arrow to non-first lists.
				var destList = (parseInt(listType,10) - 1).toString();
				formattedItem += "<button type='button' class='settingsToggle settingsToggledOff btn btn-default btn-xs' ";
				formattedItem += " data-button='moveItem' data-destination='" + destList + "'>";
				formattedItem += "<i class='fa fa-arrow-left'></i></button> ";
			}
			//Add the main checkbox to non-archive lists.
			formattedItem += "<button type='button' class='settingsToggle settingsToggledOff btn btn-default btn-xs' ";
			if (!channelArray[channelId].hasOwnProperty("listTypes"))
				formattedItem += " data-button='deleteItem'>";
			else
				formattedItem += " data-button='moveItem' data-destination='0'>";
			formattedItem += "<i class='fa fa-check'></i></button>";
		} else if (typeof defaultDestList != "undefined") {
			//Add the move arrow(s) to the archive.
			if (defaultDestList != "1") {
				//Add a second move option.
				formattedItem += "<button type='button' class='settingsToggle settingsToggledOff btn btn-default btn-xs' ";
				formattedItem += " data-button='moveItem' data-destination='1'>";
				formattedItem += "<i class='fa fa-backward'></i></button> ";
			}
			formattedItem += "<button type='button' class='settingsToggle settingsToggledOff btn btn-default btn-xs' ";
			formattedItem += " data-button='moveItem' data-destination='" + defaultDestList + "'>";
			formattedItem += "<i class='fa fa-arrow-left'></i></button>";
		}

		//Settings section
		formattedItem += "<div class='btn-group dropdown settingsToggle settingsToggledOn pull-right'>";
		formattedItem += " <button type='button' class='btn btn-default btn-xs dropdown-toggle' data-toggle='dropdown'>";
		formattedItem += "<i class='fa fa-ellipsis-h'></i></button>";
		formattedItem += "<ul class='dropdown-menu' role='menu'>";

		if (channelArray[channelId].hasOwnProperty("listTypes")) {
			//Add the move options
			for (var li in channelArray[channelId].listTypes) {
				if (li != listType && li != 0) {
					formattedItem += "<li><a href='#' data-button='moveItem' data-destination='" + li + "'>";
					formattedItem += "<i class='fa fa-" + (listType == "0" || parseInt(listType,10) > parseInt(li,10) ? (channelArray[channelId].listTypes.length > 2 && li == "1" && listType == "0" ? "backward" : "arrow-left") : "arrow-right") + "'></i>";
					formattedItem += " Move to " + channelArray[channelId].listTypes[li].title + "</a></li>";
				}
			}
			if (listType != "0") {
				//Add the archive option
				formattedItem += "<li><a href='#' data-button='moveItem' data-destination='0'><i class='fa fa-check'></i> Archive</a></li>";
			}
			//Edit option
			formattedItem += "<li class='divider'></li>";
			formattedItem += "<li><a href='#' data-button='editItem'><i class='fa fa-pencil'></i> Edit</a></li>";

			//Add the deletion option to all lists
			formattedItem += "<li><a href='#' data-button='deleteItem'><i class='fa fa-times'></i> Delete</a></li>";
		} else {
			//Add just the edit button.
			formattedItem += "<li><a href='#' data-button='editItem'><i class='fa fa-pencil'></i> Edit</a></li>";
		}
		//end of settings menu
		formattedItem += "</ul></div>";

		formattedItem += "</div>";
		return formattedItem;
	}

	function updateLists(channelId,updatedLists) {
		//Update the item lists on move.
		//Vacuous moves should be blocked before this point, so we just update the lists.
		var channelUpdates = {
			raw: [{
				type: api.message_annotation_type,
				value: {'lists': updatedLists}
			}]
		};
		var promise = $.pnut.channel.update(channelId, channelUpdates, updateArgs);
		promise.then(completeUpdateLists, function (response) {context.ui.failAlert('Failed to move item.');});
	}

	function completeUpdateLists(response) {
		//Handle all channel sublist updates.
		var thisChannel = response.data;
		for (var a = 0; a < thisChannel.raw.length; a++) {
			if (thisChannel.raw[a].type == api.message_annotation_type) {
				var annotationValue = thisChannel.raw[a].value;
			}
		}
		if (annotationValue) {
			if (annotationValue.lists)
				channelArray[thisChannel.id].lists = annotationValue.lists;
		}
	}

	function completeDelete(response) {
		//Use deletion response data to remove the HTML item.
		$("#item_" + response.data.id).remove();
		//Clean up sublists?
	}

	function updateSublistOnAdd(channelId, messageId, listType) {
		//Another sublist updater.
		//Called on creation after formatting, so the html is already located in the right spot. Just update the channel.
		var updatedLists = channelArray[channelId].lists;
		if (!updatedLists.hasOwnProperty(listType))
			updatedLists[listType] = [];
		updatedLists[listType].push(messageId);
		updateLists(channelId,updatedLists);
	}

})();


context.tags = (function () {

	return {
		collect: collect,
		colorize: colorize,
		display: display,
		filter: filter
	};

	//public

	function collect(currentTags,channelId) {
		//Populate the tag list with unique tags.
		var tag;
		if (!channelArray[channelId].hasOwnProperty("tagArray")) channelArray[channelId].tagArray = [];
		for (var t=0; t < currentTags.length; t++) {
			tag = currentTags[t].text;
			if (channelArray[channelId].tagArray.indexOf(tag) < 0) {
				channelArray[channelId].tagArray.push(tag);
			}
		}
	}

	function colorize(itemId) {
		//Colorize a tag or tags based on the string content.
		var selector = (itemId ? "#item_" + itemId + " .tag" : ".tag"); 
		$(selector).each(function(index) {
			if (!$(this).hasClass("colorized")) {
				var thisColor = getColor($(this).html().toLowerCase());
				$(this).css("background-color", thisColor).css("border-color", thisColor).css("color", getContrastYIQ(thisColor.substring(1,7))).addClass("colorized");
			}
		});
	}

	function display(channelId) {
		//Display tags for the channel.
		if (!channelId) 
			channelId = api.currentChannel;
		//Display unique tags.
		if (channelArray[channelId].tagArray.length == 0) {
			$("#searchRow").hide();
		} else {
			//Note this sorts the original array.
			var sortedArray = channelArray[channelId].tagArray.sort();
			for (var ut=0; ut < sortedArray.length; ut++) {
				displayTag(sortedArray[ut]);
			}
			colorize();
			activateTagButtons();
			$("#searchRow").show();
		}
	}
	
	function filter(unhashedTag) {
		
		//Filter based on tag.
		if (!unhashedTag) {
			return;
		} else {
			//Filter further.
			$("#sectionLists").find("div.list-group-item").each(function(index) {
				if ($(this).find("span[data-tag-name='" + unhashedTag + "']").length == 0 && (!$(this).hasClass("active")))
					$(this).addClass("hideForSearch").hide();
				else {
					//Show archived items.
					if (!$(this).hasClass("hideForSearch"))  
						$(this).show();
				}
			});
		}
		context.ui.forceScroll("#sectionLists");
	}
	
	//private
	function displayTag(unhashedTag) {
		//Display tags individually as part of the tag collection process.
		var tagString = "<button type='button' class='btn btn-default btn-sm tag' value='" + unhashedTag + "'>#" + unhashedTag + "</button> ";
		$(".tagBucket").append(tagString);
	}

	function activateTagButtons() {
		//The tags within items are activated elsewhere.
		$("button.tag").click(context.ui.tagButton);
	}

	function getColor(str) {
		//Get a random color from the tag text.
		for (var i = 0, hash = 0; i < str.length; hash = str.charCodeAt(i++) + ((hash << 5) - hash));
		color = Math.floor(Math.abs((Math.sin(hash) * 10000) % 1 * 16777216)).toString(16);
		var paddedColor = '#' + Array(6 - color.length + 1).join('0') + color;
		// mix the color with white (255, 255, 255) or our green 229, 245, 222 a la
		// http://stackoverflow.com/questions/43044/algorithm-to-randomly-generate-an-aesthetically-pleasing-color-palette
		var pastelColor = "#" + Math.floor((parseInt(paddedColor.substring(1,3), 16) + 229)/2).toString(16) + Math.floor((parseInt(paddedColor.substring(3,5), 16) + 245)/2).toString(16) + Math.floor((parseInt(paddedColor.substring(5,7), 16) + 222)/2).toString(16);
		return pastelColor;
	}
	
	function getContrastYIQ(hexcolor) {
		//Get the contrast color for user-defined tag colors using the YIQ formula.
		var r = parseInt(hexcolor.substr(0,2),16);
		var g = parseInt(hexcolor.substr(2,2),16);
		var b = parseInt(hexcolor.substr(4,2),16);
		var yiq = ((r*299)+(g*587)+(b*114))/1000;
		return (yiq >= 128) ? 'black' : 'white';
	}

})();


context.search = (function () {

	return {
		filter: filter,
		unfilter: unfilter
	};

	//public

	function filter(e) {
		//TODO: live search with debounce (search without submitting).

		var term = $.trim($("#textSearchField").val().toLowerCase());
		//Filter lists based on search term.
		if (!term) {
			return;
		} else {
			//Filter further.
			$("#sectionLists").find("div.list-group-item.formattedItem").each(function(index) {
				var currentItem = $(this);
				var textIn = currentItem.find("span.list-group-item-text span[itemtype='https://pnut.io/schemas/Post']");
				textIn.contents().each(function() {
					if (this.nodeType == Node.TEXT_NODE && $.trim(this.textContent).length) {
						if (this.textContent.toLowerCase().indexOf(term) === -1) {
							currentItem.addClass("hideForSearch").hide();
						} else {
							//Make text search self-reset.
							currentItem.removeClass("hideForSearch").show();
							//We don't want to check more text chunks if we've already found a match, so continue:
							return false;
						}
					}
					return true;
				});
			});
		}

		//While not live searching:
		$("#textSearchField").blur();
		context.ui.forceScroll("#sectionLists");
	}
	
	function unfilter(e) {
		//Reset filtration.  (Affects tag search and text search.)
		$("#sectionLists").find("div.list-group-item").filter(".hideForSearch").not(".hideForCollapse").show();
		//Reset classes.
		$("div.formattedItem").removeClass("hideForSearch");
		//Clear search.
		$("#textSearchField").val("");
	}

})();


context.list = (function () {

	return {
		add: add,
		defaultToggle: defaultToggle,
		edit: edit,
		remove: remove
	};

	//public
	function add(e) {
		//Validate and add a new list set.
		if ($("input#newListName").val() == "") {
			context.ui.failAlert("Please provide a name for the new list.");
			$("input#newListName").parent().addClass("has-error");
			return;
		}
		if (!api.accessToken) {
			context.ui.failAlert("Please log in to create your own lists.");
			$("input#newListName").parent().addClass("has-error");
			return;
		}

		var newListName = $("input#newListName").val();
		var newChannel = {
			type: api.channel_type,
			auto_subscribe: true,
			raw:  [{
				type: api.annotation_type,
				value: {'name': newListName}
			}]
		};
		//Sublist cases.
		var listTypesObj = {};
		switch ($("#addControl input:radio[name=newListType]:checked" ).val()) {
			case "2":
				listTypesObj = {'0': {'title':'archive'},
								'1': {'title':'to do'}
							   };
				break;
			case "3":
				listTypesObj = {'0': {'title':'archive'},
								'1': {'title':'now'},
								'2': {'title':'later'}
							   };
				break;
			case "4":
				listTypesObj = {'0': {'title':'unrated'},
								'1': {'title':'good'},
								'2': {'title':'average'},
								'3': {'title':'bad'}
							   };
				break;
			default:
				break;
		}
		if (Object.keys(listTypesObj).length > 0) {
			newChannel.raw = [{
				type: api.annotation_type,
				value: {'name': newListName,
					    'list_types': listTypesObj }
			}];
		}
		//Create it!
		var promise = $.pnut.channel.create(newChannel,updateArgs);
		promise.then(completeCreateChannel, function (response) {context.ui.failAlert('Failed to create new list.');});
	}

	function defaultToggle(e) {
		//Swap the defaulting (smartly).
		if (api.defaultChannel && api.defaultChannel == api.currentChannel) {
			context.init.unsetStorage("defaultChannel");
		} else {
			//Either there's no default, or we're switching it to a new value.
			context.init.checkStorage("defaultChannel", api.currentChannel);
		}
		//Swap the UI (dumbly).
		context.ui.defaultToggle();
	}

	function edit(e) {
		//Handle UI submit of an edit.
		//Check that the form is, in fact, dirty.
		var clean = true;
		$("#listControl input").each(function (index) {
			if ($(this).prop("defaultValue") != $(this).val()) 
				clean = false;
		});
		if (clean) {
			context.ui.failAlert("No edits found.");
			return;
		}
		//Check that the list and any sublists still have titles.
		var empty = false;
		$("#listControl input.listTitle").each(function (index) {
			if ($(this).val() == "") {
				empty = true;
				//Reset to original value. Was .css("box-shadow","0 0 10px #9C4449"), but switched to the Bootstrap way.
				$(this).val($(this).prop("defaultValue")).parent().addClass("has-error");
			}
		});
		if (empty) {
			context.ui.failAlert("List and sublist titles are required.");
			return;
		}
		//Check for fakes.
		if (context.channel.isSampleChannel()) {
			context.ui.failAlert("Editing of the sample lists is disabled.");
			return;
		}
		//Ready to edit.
		editLists(api.currentChannel);
	}

	function remove() {
		//TODO.
		//Remove a list set. This option should only be displayed for the channel owner.
		confirm("Are you sure you want to delete this list?  This action cannot be undone.");
	}

	//private
	function completeCreateChannel(response) {
		//Do all the updates involved with having added a channel (not unlike the edit updates).
		var channelId = response.data.id;
		var annotations = context.channel.getAnnotations(response.data);
		//Update the channelArray.
		context.channel.storeChannel(response.data, annotations);
		//Update the channel switcher, switch it, and manually fire the onchange.
		var optionString = "<option id='channel_" + channelId + "' value='" + channelId + "'" + ">" + channelArray[channelId].name + "</option>";
		$("select#listSetSelect").append(optionString);
		$("select#listSetSelect option#channel_" + channelId).prop("selected", true);
		context.init.reloadChannel(channelId);
	}

	function editLists(currentChannel) {
		//Do the actual list edits (called after form checking).
		var newName = $("#listGroupName").val();
		var channelEdits = {
			raw:  [{
				type: api.annotation_type,
				value: { 'name': newName }
			}]
		};
		var sublistObject = {};
		for (var i=0; i< $("#sublistControl div.listControl").length; i++) {
			sublistObject[i.toString()] = {title: $("input#sublistEdit_" + i).val()};
			if ($("input#sublistSubtitle_" + i).val() != "")
				sublistObject[i.toString()] = {title: $("input#sublistEdit_" + i).val(), subtitle: $("input#sublistSubtitle_" + i).val()};
		}
		if (Object.keys(sublistObject).length > 0) {
			channelEdits = {
				raw:  [{
					type: api.annotation_type,
					value: { 'name': newName,
									 'list_types': sublistObject
								 }
				}]
			};

		}
		var promise = $.pnut.channel.update(currentChannel, channelEdits, updateArgs);
		promise.then(completeEditLists,  function (response) {context.ui.failAlert('Failed to update list.');});
	}

	function completeEditLists(response) {
		//Rename lists based on the response we got back.  
		//This would be easier with a reload...
		var channelId = response.data.id;
		var annotations = context.channel.getAnnotations(response.data);
		//Update the channelArray.
		context.channel.storeChannel(response.data, annotations);
		//Update the UI.
		context.ui.nameList(channelId);
		if (channelArray[channelId].hasOwnProperty("listTypes")) {
			for (var key in Object.keys(channelArray[channelId].listTypes)) {
				context.ui.nameSublist(parseInt(key),channelArray[channelId].listTypes);
			}
		}
		//This was not part of nameList.
		$("option#channel_" + channelId).text(channelArray[channelId].name);
		//Give some UI feedback.
		$("button#saveListEdits").addClass("btn-success").removeClass("btn-custom");
	}

})();


context.user = (function () {

	return {
		add: add,
		display: display,
		fix: fix,
		remove: remove,
		search: search
	};

	//public
	function add(e) {
		//Add a user on UI request (from search list) to full.
		var currentChannel = api.currentChannel;
		var userId = $(e.target).closest("a[data-user]").data("user");
		var newUsers = channelArray[currentChannel].editorIds.slice();
		if (!context.channel.isSampleChannel(currentChannel)) {
			newUsers.push(userId);
			var userUpdates = {
				acl: {full: {user_ids: newUsers}} 
			};
			var promise = $.pnut.channel.update(currentChannel,userUpdates);
			promise.then(completeAddUser, function (response) {context.ui.failAlert('Addition of member failed.');});
		}
		var userRow = $("div#searchResults div#userRow_search_" + userId).detach();
		$("div#memberResults").append(userRow);
		$("div#memberResults div#userRow_search_" + userId + " a").remove();
	}

	function display(result, type) {
		//Display a user based on response or canned data.
		var resultLocation = "div#memberResults";
		var rowId = "userRow_" + (type ? type + "_" : "") + result.id;
		var resultString = "<div class='form-group memberRow' id='" + rowId + "'>";
		resultString += "<div class='col-xs-4 col-md-5 text-right'>" + (result.content.avatar_image.is_default ? "" : "<img src='" + result.content.avatar_image.link + "' class='avatarImg' />") + "</div>";
		resultString += "<div class='col-xs-4 col-md-2 text-center'>@" + result.username + (result.name ? "<br /><span class='realName'>" + result.name + "</span>" : "" ) + "</div>";
		resultString += "<div class='col-xs-4 col-md-5 text-left'>";
		if (type && type=="search") {
			//Should add a check for existing membership here.
			resultString += "<a class='btn btn-default btn-sm' href='#sectionSettings' title='Add member' data-button='addUser' data-user='" + result.id + "'><i class='fa fa-plus'></i></a>";
			resultLocation = "div#searchResults";
		} else if (!type || type != "owner") {
			resultString += "<a class='btn btn-default btn-sm' href='#sectionSettings' title='Remove member' data-button='removeUser' data-user='" + result.id + "'><i class='fa fa-times'></i></a>";
		}
		resultString += "</div></div>";
		$(resultLocation).append(resultString);
		activateButtons(rowId);
	}

	function fix(channelId) {
		//Repair write users; make them full users.
		var newEditorIds =	channelArray[channelId].editorIds.concat(channelArray[channelId].oldEditorIds);
		var userUpdates = {
			acl: {
				full: {user_ids: newEditorIds},
				write: {user_ids: []}
			} 
		};
		var promise = $.pnut.channel.update(channelId,userUpdates);
		//We can use the promise recipient from the regular add function to update the channel.
		promise.then(completeAddUser, function (response) {context.ui.failAlert('Channel repair failed.');});
	}

	function remove(e) {
		//Handle UI request to remove a user.
		var userId = $(e.target).closest("a[data-user]").data("user");
		removeUserFromChannel(userId,api.currentChannel);
		$("div#userRow_" + userId).remove();
	}

	function search() {
		//Search for pnut users in member control.
		if (!api.accessToken) {
			context.ui.failAlert("Please log in to search for users.");
			return;
		}

		$("div#searchResults").html("");
		//No longer a search b/c no search in pnut yet.
		var promise = $.pnut.user.get($("input#userSearch").val());
		promise.then(completeSearch, function (response) {context.ui.failAlert('Search request failed.');});
	}

	//private

	function activateButtons(rowId) {
		//Maybe do this on init?
		$("#" + rowId + " a[data-button='addUser']").click(context.user.add);
		$("#" + rowId + " a[data-button='removeUser']").click(context.user.remove);
	}

	function completeAddUser(response) {
		//Update the channel array based on the response.
		channelArray[response.data.id].editors = response.data.editors;
		channelArray[response.data.id].editorIds = response.data.acl.full.user_ids;
		//Re: fixing.
		channelArray[response.data.id].oldEditorIds = response.data.acl.write.user_ids;
	}

	function removeUserFromChannel(userId, channelId) {
		//User nuker.
		var newUsers = channelArray[channelId].editorIds.slice();
		//ADN's version of the array is of strings.
		var index = newUsers.indexOf(userId.toString());
		if (index > -1 && !context.channel.isSampleChannel(channelId)) {
			newUsers.splice(index, 1);
			var userUpdates = {
				editors: {user_ids: newUsers} 
			};
			var promise = $.pnut.channel.update(channelId,userUpdates);
			promise.then(completeRemoveUser, function (response) {context.ui.failAlert('Removal of member failed.');});
		}
		//Remove the user from the UI.
		$("div#userRow_editor_" + userId).remove();
	}

	function completeRemoveUser(response) {
		//Update only the channel array based on the response.
		channelArray[response.data.id].editors = response.data.editors;
		channelArray[response.data.id].editorIds = response.data.editors.user_ids;
	}

	function completeSearch(response) {
		//Process search results into the UI.  (Now a single user.)
		if (response.data.length == 0) {
			$("div#searchResults").html("<p>No users found.</p>");
		} else {
				display(response.data, "search");
		}
	}

})();

//needs cleanup

context.ui = (function () {

	return {
		add: add,
		addMember: addMember,
		collapseArchive: collapseArchive,
		controlToggle: controlToggle,
		defaultToggle: defaultToggle,
		displaySortOrder: displaySortOrder,
		failAlert: failAlert,
		forceScroll: forceScroll,
		itemTag: itemTag,
		nameList: nameList,
		nameSublist: nameSublist,
		navbarSetter: navbarSetter,
		pushHistory: pushHistory,
		settingsOff: settingsOff,
		sortLists: sortLists,
		tagButton: tagButton,
		uncollapseArchive: uncollapseArchive
	};

	//public
	function add(e) {
		//Handle the UI button(s).
		var listType = $(e.target).closest("div.bucketListDiv").data("type");
		var theList = $("input:radio[name=bucketBucket][data-list=" + listType + "]").prop('checked', true);
		forceScroll("#sectionAdd");
	}

	function addMember(e) {
		//Handle the UI button(s).
		$("#addMember").show();
	}

	function collapseArchive() {
		//Handle the archive concealment.
		var targetCount = 7;
		var formattedButton = "<div class='list-group-item list-group-item active clearfix text-center' id='uncollapseArchiveWrapper' title='Expand this list.'>";
		formattedButton += "<span class='uncollapseButton' style='padding:0 15px;font-size:24px;cursor:pointer;'><i class='fa fa-expand'></i></span></div>";
		
		$("div[id != 'list_0'].bucketListDiv div.list-group").each(function() {
      targetCount = Math.max(targetCount, $(this).children().length - 1);
		});

		//Test for presence of the archive purely in the UI.
		if ($("div#list_0 div.list-group").children().length > targetCount) {
			$("#list_0 div.formattedItem:gt(" + targetCount + ")").addClass("hideForCollapse").hide();
			if ($("#uncollapseArchiveWrapper").length == 0)
				$("#list_0 div.list-group").append(formattedButton);
			
			//Possibly hide the re-collapse button.
			$("div#list_0 span.collapseButton").hide();
		}
	}

	function controlToggle(e) {
		//Handle the UI list management toggle buttons.
		var control = $(e.target).closest("a").data("control");
		if ($("div#" + control).is(":visible")) {
			//Toggle all off.
			$(".control").hide();
		} else {
			//Show one.
			$(".control").hide();
			$("div#" + control).show();
		}
	}

	function defaultToggle() {
		//Handle the UI default list toggle buttons.
		$("span#defaultToggle i").toggleClass("fa-star fa-star-o");
		if ($("span#defaultToggle i").hasClass("fa-star-o")) {
			//Toggled on.
			$("span#defaultToggle").attr("title", "Make this my default list(s).");
		} else {
			//Toggled off.
			$("span#defaultToggle").attr("title", "Your default list(s). (Click to remove default.)");
		}
	}

	function displaySortOrder(order) {
		//Programmatically change the radio button for sort order.
		$("div#bucketSorterWrapper input[type=radio]").prop("checked",false);
		$("div#bucketSorterWrapper input[type=radio][value='" + order +"']").prop("checked",true);
	}

	function failAlert(msg) {
		//Error reporter.
		alert(msg);
	}

	function forceScroll(hash) {
		//Scroller.
		var target = $(hash);
		$('html,body').animate({scrollTop: target.offset().top - 50}, 1000);
		//navbarSetter(hash);
		return false;
	}

	function itemTag(unhashedTag) {
		//Handle UI click on tags within lists.
		//Clicking a tag in the lists restricts the lists to that tag.
		context.tags.filter(unhashedTag);
	}

	function nameList(channelId) {
		//Process the channel name itself. Pass in the whole input for the editor to preserve defaultValue.
		$("#listTitleSPAN").html(channelArray[channelId].name);
		$("div#listGroupNameWrapper").html("<input type='text' id='listGroupName' class='form-control listTitle' value='" + channelArray[channelId].name + "' />");
		//If  nameSublist is called, this will be re-filled.
		$("div#list_1 span.mainTitle").html("<i class='fa fa-fw'></i>");
	}
	
	function nameSublist(index, listTypesObj) {
		//Handle the sublist titles and subtitles.
		$("div#list_" + index + " span.mainTitle").html(listTypesObj[index.toString()].title);
		$("div#itemCheckboxes span#label_" + index).html(listTypesObj[index.toString()].title);
		$("div#itemCheckboxes span#label_" + index).closest("label").show();

		if (listTypesObj[index.toString()].hasOwnProperty("subtitle")) {
			$("div#list_" + index + " span.subTitle").html(listTypesObj[index.toString()].subtitle);
		} else {
			$("div#list_" + index + " span.subTitle").html("");
		}
	}
	
	function navbarSetter(hashSectionName) {
		//Deal with navbar issues.
		$("div#navbar-collapsible ul li").removeClass("active");
		//Not sure I need this.
		//if (hashSectionName) 
		//	$("div#navbar-collapsible ul li a[href = hashSectionName]").addClass("active");
	}
	
	function pushHistory(newLocation) {
		//Sets the location (mainly to clear out the access token).
		if (history.pushState) 
			history.pushState({}, document.title, newLocation);
	}

	function settingsOff() {
		//Toggle all settings off, in order to add buttons or items in the default state.
		$(".settingsToggledOff").show();
		$(".settingsToggledOn").hide();
	}

	function sortLists(e) {
		//Handle the sort radio on the list.
		var sortCode = $(e.target).val();
		if (sortCode && sortCode != api.sortOrder && sortCode.length == 2) {
			//Set the value & resort.
			context.init.setSortOrder(sortCode);
		}
	}
	
	function tagButton(e) {
		//Add the tag to the item for the Add Item form, or filter by the tag for the list display.
		if ($(e.target).closest("form").attr("id") == "bucketItemEntry")
			$("#item").val($("#item").val() + " #" + $(e.target).val());
		else
			context.tags.filter($(e.target).val());
	}

	function uncollapseArchive() {
		//Undo the archive concealment.
		var targetCount = 7;
		$("div#uncollapseArchiveWrapper").remove();
		$("#list_0 div.formattedItem").removeClass("hideForCollapse").filter(":not(.hideForSearch)").show();
		//Show a re-collapse button.
		$("div#list_0 span.collapseButton").show();
	}

})();

})(marketBucket);


/* eof */
