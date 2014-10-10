//main.js for Market Bucket by @mcdemarco.

//To force authorization: https://account.app.net/oauth/authorize etc.
var authUrl = "https://account.app.net/oauth/authenticate?client_id=" + api['client_id'] + "&response_type=token&redirect_uri=" + encodeURIComponent(api.site) + "&scope=messages:" + api.channel_type;

var updateArgs = {include_annotations: 1};

var channelArray = {};
var messageTextArray = {};

/* main execution path */

function initialize() {
	$("a.adn-button").attr('href',authUrl);
	$("a.h1-link").attr('href',api.site);
	$("a#fontBrandLink").click(function(){navbarSetter();});
	checkLocalStorage();
	if (!api.accessToken) {
		logout();
		return;
	}
	$.appnet.authorize(api.accessToken,api.client_id);
	if (!$.appnet.token.get()) {
			api.accessToken = '';
			logout();
			return;
	} else {
		pushHistory(api.site);
		$(".loggedOut").hide();
		getChannels();
		$(".loggedIn").show('slow');
		checkLocalStorageUser();
	}
	//mb_tags.colorize();
}

function createChannel(listTypeObj) {
	//Create a new placeholder default channel for the user.
	//Later, allow the user to pick his list types and name, if any.
	var channel = {
		type: api.channel_type,
		auto_subscribe: true,
		annotations:  [{
						  type: api.annotation_type,
						  value: {'default_list': 1}
					  }]
	};
	var promise1 = $.appnet.channel.create(channel);
	promise1.then(completeCreateChannel, function (response) {failAlert('Failed to create new list.');});
}

function completeCreateChannel() {
	//console.log("channels created");
}

function getChannels() {
	//Determine channels.
	var args = {
		include_annotations: 1,
		include_inactive: 0,
		order: 'activity',
		type: api.channel_type
	};
	var promise = $.appnet.channel.search(args);
	promise.then(completeChannels, function (response) {failAlert('Failed to retrieve your list(s).');}).done(mb_tags.colorize);
}

function completeChannels(response) {
	if (response.data.length > 0) {
		for (var c = 0; c < response.data.length; c++) {
			var thisChannel = response.data[c];
			//Not assuming we're the only annotation.
			var annotationValue = {};
			var annotationValue2 = {};
			for (var a = 0; a < thisChannel.annotations.length; a++) {
				if (thisChannel.annotations[a].type == api.annotation_type) {
					annotationValue = thisChannel.annotations[a].value;
				}
				if (thisChannel.annotations[a].type == api.message_annotation_type) {
					annotationValue2 = thisChannel.annotations[a].value;
				}
			}
			//Eject if no settings annotation.
			if (!annotationValue) continue;
			//Eject if user can't write to channel. (unlikely)
			// ...

			processChannel(response.data[c], annotationValue, annotationValue2);

			if (Object.keys(channelArray).length == 1) {
				//This channel is first in the activity ordering and will be our default if one wasn't saved.
				checkLocalStorageChannel(thisChannel.id);
			}

			//Fetch more data if this is the right channel.
 			if (api.currentChannel && api.currentChannel == thisChannel.id) {
				displayChannel(thisChannel);
			}
		}
		processChannelList();

	} else {
		//Ask before creating; the user may not want them.
		//Or make a publically writeable sandbox channel set...
		//createChannel();
	}

	function processChannel(thisChannel, annotationValue, messageAnnotationValue) {
		//Save data for every channel.
		channelArray[thisChannel.id] = {"id" : thisChannel.id,
										"name" : annotationValue["name"],
										"owner" : thisChannel.owner.id,
										"editors" : thisChannel.editors.user_ids,
										"annotationValue" : annotationValue};
		if (annotationValue.hasOwnProperty("list_types")) {
			channelArray[thisChannel.id].listTypes = annotationValue.list_types;
			channelArray[thisChannel.id].lists = messageAnnotationValue.lists;
		}
		if (messageAnnotationValue.hasOwnProperty("deletion_queue")) {
			channelArray[thisChannel.id].deletionQueue = messageAnnotationValue.deletion_queue;
		}
	}

	function processChannelList() {
		//Put the channel list into the settings dropdown.
		for (var ch in channelArray) {
			if (channelArray.hasOwnProperty(ch)) {
				var optionString = "<option id='channel_" + ch + "' value='" + ch + "'" + ((ch == api.currentChannel) ? " selected" : "") + ">" + channelArray[ch].name + "</option>";
				$("select#listSet").append(optionString);
			}
		} 
	}
}

function getChannel(channelId) {
	//Get a single channel.
	var args = {
		include_annotations: 1,
		type: api.channel_type
	};
	var promise = $.appnet.channel.get(channelId, args);
	promise.then(completeChannel, function (response) {failAlert('Failed to retrieve your list.');}).done(mb_tags.colorize);
}

function completeChannel(response) {
	if (response.data)
		displayChannel(response.data);
}

function displayChannel(thisChannel) {
	//Users in settings panel.
	var listTypes = (channelArray[thisChannel.id].listTypes ? channelArray[thisChannel.id].listTypes : {});
	processChannelUsers(thisChannel);

	//Process the channel name itself.
	$("input#listGroupName").val(channelArray[thisChannel.id].name);

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
		listNamer(1, listTypes);

		//Layout adjustment for the big screen.
		$("div#list_1").removeClass("col-sm-offset-4");
		if (len == 2) $("div#list_1").addClass("col-sm-offset-2");
		if (len == 4) $("div#list_0").addClass("col-sm-offset-4");
		
	} else {

		//Name main list after list group.
		$("div#list_1 span.mainTitle").html(channelArray[thisChannel.id].name);

	}
	//Button activation
	initializeButtons();

	//Retrieve the messages.
	var args = {
		include_deleted: 0,
		count: api.message_count
	};
	var promise = $.appnet.message.getChannel(thisChannel.id, args);
	promise.then(completeMessages, function (response) {failAlert('Failed to retrieve items.');}).done(mb_tags.display);


	function listCloner(index, listTypesObj) {
		$("div#list_1").clone().attr("id","list_" + index).data("type",index).appendTo("div#bucketListHolder").removeClass("col-sm-offset-4");
		listNamer(index, listTypesObj);
		editCloner(index, listTypesObj);
	}

	function editCloner(index, listTypesObj) {
		$("#sublistControls").append("<div class='form-group listControl'><div class='col-xs-4 text-right'><label class='control-label' for='sublistEdit_" + index + "'>" + (index == 0 ? "Archive" : "List " + index) + ":</label></div><div class='col-xs-3'><input type='text' id='sublistEdit_" + index + "' class='form-control' value='" + listTypesObj[index.toString()].title + "' /></div><div class='col-xs-4'><input type='text' id='sublistSubtitle_" + index + "' class='form-control' value='" + (listTypesObj[index.toString()].subtitle ? listTypesObj[index.toString()].subtitle : "") + "' /></div></div>");
	}
	
	function listNamer(index, listTypesObj) {
		$("div#list_" + index + " span.mainTitle").html(listTypesObj[index.toString()].title);
		$("div#itemCheckboxes span#label_" + index).html(listTypesObj[index.toString()].title);
		$("div#itemCheckboxes span#label_" + index).closest("label").show();

		if (listTypesObj[index.toString()].hasOwnProperty("subtitle")) {
			$("div#list_" + index + " span.subTitle").html(listTypesObj[index.toString()].subtitle);
		}
	}
}

function completeMessages(response) {
	//Populate the UI for an individual retrieved list.
	if (response.data.length > 0) {
		for (var i=0; i < response.data.length; i++) {
			var respd = response.data[i];
			//Mock deletion check.
			if (channelArray[respd.channel_id].hasOwnProperty("deletionQueue") && channelArray[respd.channel_id].deletionQueue.indexOf(respd.id) > -1) {
				if (respd.user.id == api.userId) {
					//Delete if creator and remove from queue.
					var promise = $.appnet.message.destroy(api.currentChannel,respd.id);
					promise.then(completeAutoDelete,  function (response) {failAlert('Failed to delete queued item.');});
				}
				//In either case, don't display "deleted" item or retrieve its tags.
				continue;
			}
			mb_item.format(respd);
			mb_tags.collect(respd.entities.hashtags,respd.channel_id);
		}
	}
}

function processChannelUsers(thisChannel,annotationValue) {
	//Owner not included in the editors list, so add separately.
	displayUserResult(thisChannel.owner, "owner");
	//User data.
	if (thisChannel.editors.user_ids.length > 0) {
		//Retrieve the user data.
		var promise = $.appnet.user.getList(thisChannel.editors.user_ids);
		promise.then(completeUsers, function (response) {failAlert('Failed to retrieve users.');});
	}
	//Ownership hath its privileges.
	if (thisChannel.owner.id != api.userId) {
		//There's nothing in this category right now, but deleting the list would qualify.
		$(".listOwner").hide();
	} else {
		//For list switching.
		$("form#settingsForm a.btn").show();
	}
}

function completeUsers(response) {
	for (u=0; u < response.data.length; u++) {
		displayUserResult(response.data[u],"editor");
	}
}

function reinitialize(newChannel) {
	if (api.currentChannel == newChannel) return;
	if (!channelArray.hasOwnProperty(newChannel)) {
		failAlert("Failed to change the channel.");
		return;
	}
	//Now we're ready to restore to an initializable state.
	clearPage();
	setLocalStorageChannel(newChannel);
	getChannel(newChannel);
	forceScroll("#sectionLists");
}

function clearPage() {
	//Clear the form.
	clearForm();
	$("div#itemCheckboxes label").hide();
	//Nuke the sublists.
	for (var i=0; i < api.max_sublists; i++) {
		if (i != 1)
			$("#list_" + i).remove();
	}
	//Clear the main list. (Assume title will be rewritten.)
	$("#list_1 div.formattedItem").remove();
	$("#list_1 span.subTitle").html("");
	$("#list_1").removeClass("col-sm-offset-2").addClass("col-sm-offset-4");
	$(".tagBucket").html("");
	//Clear the relevant settings.
	$("div#memberResults").html("");
	$("div#searchResults").html("");
	//Clear the list controls.
	$("div#sublistControls").html("");
	//...
}

/* item functions */

var mb_item = (function () {

	return {
		add: add,
		clearForm: clearForm,
		deleteIt: deleteIt,
		edit: edit,
		format: format,
		move: move
	};

	//public
	function add() {
		var channelId = api.currentChannel;
		var message = $("textarea#item").val();
		if (message == "") {
			alert("No item text entered.");
			return;
		}
		if (channelArray[channelId].hasOwnProperty("listTypes") && !$("input[name=bucketBucket]").is(":checked")) {
			//This shouldn't be reachable anymore...
			alert("No list selected for item.");
			return;
		}
		//The edit case.
		if ($("#editItemId").val() != "") {
			if (message == messageTextArray) {
				alert("Message was not changed.");
				return;
			} else {
				deleteIt($("#editItemId").val());
				//There's a clearForm() later on, but do this to be extra safe:
				$("#editItemId").val("");
			}
		}
		//Don't want the new buttons starting out of sync.
		$(".settingsToggle").hide();
		createItem(channelId, message);
	}

	function clearForm() {
		$("textarea#item").val("");
		$("button#addButton").html("Add Item");
		$("#editItemId").val("");
	}

	function deleteIt(itemId) {
		//On active delete, check for ownership and delete if owned or add to queue if not.
		var currentChannel = api.currentChannel;
		if ($("#item_" + itemId).data("creator") == api.userId) {
			//Creator can delete for reals
			var promise = $.appnet.message.destroy(currentChannel,itemId);
			promise.then(completeDelete,  function (response) {failAlert('Failed to delete item.');});
		} else {
			//Add to deleted queue
			var updatedQueue = [];
			if (channelArray[currentChannel].hasOwnProperty("deletionQueue")) {
				updatedQueue = channelArray[currentChannel].deletionQueue.slice();
			}
			updatedQueue.push(itemId.toString());
			var channelUpdates = {
				include_annotations: 1,
				annotations:  [{
					type: api.message_annotation_type,
					value: {'deletion_queue': updatedQueue}
				}]
			};
			if (channelArray[currentChannel].hasOwnProperty("lists")) {
				channelUpdates = {
					include_annotations: 1,
					annotations:  [{
						type: api.message_annotation_type,
						value: {'lists': channelArray[currentChannel].lists,
								'deletion_queue': updatedQueue}
					}]
				};
			}
			var promise = $.appnet.channel.update(currentChannel, channelUpdates, updateArgs);
			promise.then(completeUpdateLists,  function (response) {failAlert('Failed to remove item.');});
		}
		//In either case, remove item.
		$("#item_" + itemId).remove();
	}

	function edit(itemId) {
		//Populate the form with the stored data, change the buttons, and scroll to it.
		$("textarea#item").val(messageTextArray[itemId]);
		var listType = $("#item_" + itemId).closest("div.bucketListDiv").data("type");
		$("input:radio[name=bucketBucket][data-list=" + listType + "]").prop('checked', true);
		$("button#addButton").html("Edit Item");
		$("#editItemId").val(itemId.toString());
		forceScroll("#sectionAdd");
	}

	function format(respd, sublist) {
		//Default (sub)list.
		var listType = (sublist ? sublist : 1);
		//Check for alternate sublist IF the list has official sublists and it wasn't passed in.
		if (!sublist && channelArray[respd.channel_id].hasOwnProperty("listTypes")) {
			for (var key in channelArray[respd.channel_id].listTypes) {
				if (channelArray[respd.channel_id].listTypes.hasOwnProperty(key) && 
					channelArray[respd.channel_id].lists.hasOwnProperty(key) &&
					channelArray[respd.channel_id].lists[key].indexOf(respd.id) > -1) {
					listType = key;
				}
			}
		}
		
		var itemDate = new Date(respd.created_at);
		var formattedItem = "<div class='list-group-item clearfix formattedItem' id='item_" + respd.id + "' data-creator='" + respd.user.id + "'>";
		formattedItem += "<span class='list-group-item-text' title='Added " + itemDate.toLocaleString() + " by " + respd.user.username + "'>";
		formattedItem += respd.html + "</span>";
		formattedItem += formatButtons(respd.id, respd.channel_id, listType); 
		formattedItem += "</div>";
		$("#list_" + listType + " div.list-group").append(formattedItem);
		//Pre-format the hashtags.
		$("#item_" + respd.id + " span[itemprop='hashtag']").each(function(index) {
			if (!$(this).hasClass("tag")) {
				$(this).addClass("tag").css("padding","1px 3px").css("border-radius","3px");
			}
			$(this).click(function(event) {
				event.preventDefault();
				onClickItemTag($(this).data("hashtagName"));
			});
		});
		//Store the item.
		messageTextArray[respd.id] = respd.text;
	}

	function move(itemId, targetType) {
		var currentChannel = api.currentChannel;
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
			updatedLists[targetType].push(itemId.toString());
		}
		//Send to ADN.
		updateLists(currentChannel,updatedLists);
		//Move html.
		$("#item_" + itemId).appendTo("div#list_" + targetType + " div.list-group");
		//Need to update the buttons.
		$("div#buttons_" + itemId).remove();
		//Don't want the new buttons starting out of sync.
		$("div#list_" + targetType + " .settingsToggle").hide();
		$("#item_" + itemId).append(formatButtons(itemId,currentChannel,targetType));
	}

	//private
	function create(channel,message) {
		if (!channel || channel == 0) {
			failAlert('Failed to create item.');
			return;
		}
		var newMessage = {
			text: message
		};
		var promise = $.appnet.message.create(channel, newMessage);
		promise.then(completeItem, function (response) {failAlert('Failed to create item.');});
	}
	
	function completeItem(response) {
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
		mb_tags.colorize(respd.id);
		clearForm();
		forceScroll("#sectionLists");
	}

	function formatButtons(itemId, channelId, listType) {
		if (!channelId) channelId = api.currentChannel;
		var formattedItem = "<div id='buttons_" + itemId + "' class='pull-right'>";
		if (listType != "0") {
			//Add the main checkbox.
			formattedItem += "<button type='button' class='btn btn-default btn-xs' ";
			if (!channelArray[channelId].hasOwnProperty("listTypes"))
				formattedItem += " onclick='deleteItem(" + itemId + ")";
			else
			formattedItem += " onclick='moveItem(" + itemId + ",0)";
			formattedItem += "'><i class='fa fa-check'></i></button>";
		}
		if (channelArray[channelId].hasOwnProperty("listTypes")) {
			//Add the move options
			formattedItem += "<div class='btn-group dropdown settingsToggle pull-right'>";
			formattedItem += "<button type='button' class='btn btn-default btn-xs dropdown-toggle' data-toggle='dropdown'>";
			formattedItem += "<i class='fa fa-cog'></i> <span class='caret'></span></button>";
			formattedItem += "<ul class='dropdown-menu' role='menu'>";
			for (var li in channelArray[channelId].listTypes) {
				if (li != listType && li != 0) 
					formattedItem += "<li><a href='#' onclick='mb_item.move(" + itemId + "," + li + ")'><i class='fa fa-arrows'></i> Move to " + channelArray[channelId].listTypes[li].title + "</a></li>";
			}
			//Edit option
			formattedItem += "<li class='divider'></li>";
			formattedItem += "<li><a href='#' onclick='mb_item.edit(" + itemId + ")'><i class='fa fa-pencil'></i> Edit</a></li>";
			if (listType == "0") {
				//Add the deletion option
				formattedItem += "<li><a href='#' onclick='mb_item.deleteIt(" + itemId + ");'><i class='fa fa-times'></i> Delete</a></li>";
			}
			formattedItem += "</ul></div>";
		}
		formattedItem += "</div>";
		return formattedItem;
	}

	function updateLists(channelId,updatedLists) {
		//Vacuous moves should be blocked before this point, so we just update the lists.
		var channelUpdates = {
			annotations:  [{
				type: api.message_annotation_type,
				value: {'lists': updatedLists}
			}]
		};
		if (channelArray[channelId].hasOwnProperty("deletionQueue")) {
			channelUpdates = {
				annotations:  [{
					type: api.message_annotation_type,
					value: {'lists': updatedLists,
							'deletion_queue': channelArray[channelId].deletionQueue}
				}]
			};
		}									
		var promise = $.appnet.channel.update(channelId, channelUpdates, updateArgs);
		promise.then(completeUpdateLists,  function (response) {failAlert('Failed to move item.');});
	}

	function completeUpdateLists(response) {
		//Used for all channel sublist updates.
		var thisChannel = response.data;
		for (var a = 0; a < thisChannel.annotations.length; a++) {
			if (thisChannel.annotations[a].type == api.message_annotation_type) {
				var annotationValue = thisChannel.annotations[a].value;
			}
		}
		if (annotationValue) {
			if (annotationValue.lists)
				channelArray[thisChannel.id].lists = annotationValue.lists;
			if (annotationValue.deletion_queue) 
				channelArray[thisChannel.id].deletionQueue = annotationValue.deletion_queue;
		}
	}

	function completeAutoDelete(response) {
		//Clean up the deletion queue, which we know existed.
		var updatedQueue = channelArray[response.data.channel_id].deletionQueue.slice();
		var index = updatedQueue.indexOf(response.data.id);
		if (index > -1) updatedQueue.splice(index, 1);
		
		var channelUpdates = {
			include_annotations: 1,
			annotations:  [{
				type: api.message_annotation_type,
				value: {'deletion_queue': updatedQueue}
			}]
		};
		if (channelArray[response.data.channel_id].hasOwnProperty("lists")) {
			channelUpdates = {
				include_annotations: 1,
				annotations:  [{
					type: api.message_annotation_type,
					value: {'lists': channelArray[response.data.channel_id].lists,
							'deletion_queue': updatedQueue}
				}]
			};
		}
		var promise = $.appnet.channel.update(api.currentChannel, channelUpdates, updateArgs);
		promise.then(completeUpdateLists,  function (response) {failAlert('Failed to remove item.');});
	}

	function completeDelete(response) {
		//Remove HTML item.
		$("#item_" + response.data.id).remove();
		//Clean up sublists?
	}

	function updateSublistOnAdd(channelId, messageId, listType) {
		//Called on creation after formatting, so the html is already located in the right spot. Just update the channel.
		var updatedLists = JSON.parse(JSON.stringify(channelArray[channelId].lists));
		updatedLists[listType].push(messageId);
		updateLists(channelId,updatedLists);
	}

})();

//needs cleanup

function onClickAdd(that) {
	var listType = $(that).closest("div.bucketListDiv").data("type");
	var theList = $("input:radio[name=bucketBucket][data-list=" + listType + "]").prop('checked', true);
	forceScroll("#sectionAdd");
}



/* tag functions */

var mb_tags = (function () {

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
			tag = currentTags[t].name;
			if (channelArray[channelId].tagArray.indexOf(tag) < 0) {
				channelArray[channelId].tagArray.push(tag);
			}
		}
	}

	function colorize(itemId) {
		var selector = (itemId ? "#item_" + itemId + " .tag" : ".tag"); 
		$(selector).each(function(index) {
			if (!$(this).hasClass("colorized")) {
				var thisColor = getColor($(this).html().toLowerCase());
				$(this).css("background-color", thisColor).css("border-color", thisColor).css("color", getContrastYIQ(thisColor.substring(1,7))).addClass("colorized");
			}
		});
	}

	function display(channelId) {
		if (!channelId) 
			channelId = api.currentChannel;
		//Display unique tags.
		if (channelArray[channelId].tagArray.length == 0) {
			$("#tagSearchRow").hide();
		} else {
			//Note this sorts the original array.
			var sortedArray = channelArray[channelId].tagArray.sort();
			for (var ut=0; ut < sortedArray.length; ut++) {
				displayTag(sortedArray[ut]);
			}
			mb_tags.colorize();
			$("#tagSearchRow").show();
		}
	}
	
	function filter(unhashedTag) {
		if (!unhashedTag) {
			//Reset filtration.
			$("#sectionLists").find("div.list-group-item").show();
		} else {
			//Filter further.
			$("#sectionLists").find("div.list-group-item").each(function(index) {
				if ($(this).find("span[data-hashtag-name='" + unhashedTag + "']").length == 0 && (!$(this).hasClass("active")))
					$(this).hide();
			});
		}
		forceScroll("#sectionLists");
	}

	//private
	function displayTag(unhashedTag) {
		//Display tags individually as part of the tag collection process.
		var tagString = "<button type='button' class='btn btn-default btn-sm tag' onclick='onClickTagButton(this);' value='" + unhashedTag + "'>#" + unhashedTag + "</button> ";
		$(".tagBucket").append(tagString);
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
	
	function getContrastYIQ(hexcolor){
		//Get the contrast color for user-defined tag colors using the YIQ formula.
		var r = parseInt(hexcolor.substr(0,2),16);
		var g = parseInt(hexcolor.substr(2,2),16);
		var b = parseInt(hexcolor.substr(4,2),16);
		var yiq = ((r*299)+(g*587)+(b*114))/1000;
		return (yiq >= 128) ? 'black' : 'white';
	}
})();

//needs cleanup

function onClickItemTag(unhashedTag) {
	//Clicking a tag in the lists restricts the lists to that tag.
	mb_tags.filter(unhashedTag);
}

function onClickTagButton(that) {
	//Add the tag to the item for the Add Item form, or filter by the tag for the list display.
	if ($(that).closest("form").attr("id") == "bucketItemEntry")
		$("#item").val($("#item").val() + " #" + $(that).val());
	else
		mb_tags.filter($(that).val());
}


/* settings functions */

function addSetting(that) {
	var theSetting = $(that).closest("div.form-group").prop("id");
	switch (theSetting) {
		case "memberControl":
		$("#addMember").show();
		break;
	}
}

/* user functions */

function addUser(userId) {
	var currentChannel = api.currentChannel;
	var newUsers = channelArray[currentChannel].editors.slice();
	newUsers.push(userId);
	var userUpdates = {
		editors: {user_ids: newUsers} 
	};
	var promise = $.appnet.channel.update(currentChannel,userUpdates);
	promise.then(completeAddUser, function (response) {failAlert('Addition of member failed.');});

	var userRow = $("div#searchResults div#userRow_search_" + userId).detach();
	$("div#memberResults").append(userRow);
	$("div#memberResults div#userRow_search_" + userId + " a").remove();
}

function completeAddUser(response) {
	//Update the channel.
	channelArray[response.data.channel_id].editors = response.data.editors.user_ids;
}

function removeUser(userId) {
	removeUserFromChannel(userId,api.currentChannel);
	$("div#userRow_" + userId).remove();

	function removeUserFromChannel(userId, channelInfo) {
		var newUsers = channelInfo.editors.slice();
		//ADN's version of the array is of strings.
		var index = newUsers.indexOf(userId.toString());
		if (index > -1) {
			newUsers.splice(index, 1);
			var userUpdates = {
				editors: {user_ids: newUsers} 
			};
			var promise = $.appnet.channel.update(channelInfo.channel,userUpdates);
			promise.then(completeRemoveUser, function (response) {failAlert('Removal of member failed.');});
		}
	}
}

function completeRemoveUser(response) {
	//Only update the channel.
	channelArray[response.data.channel_id].editors = response.data.editors.user_ids;
}

function searchUsers() {
	$("div#searchResults").html("");
	var searchArgs = {q: $("input#userSearch").val(), count: 10};
	var promise = $.appnet.user.search(searchArgs);
	promise.then(completeSearch, function (response) {failAlert('Search request failed.');});
}

function completeSearch(response) {
	if (response.data.length == 0) {
		$("div#searchResults").html("<p>No users found.</p>");
	} else {
		for (var u=0; u < response.data.length; u++) {
			displayUserResult(response.data[u], "search");
		}	
	}
}

function displayUserResult(result, type) {
	var resultLocation = "div#memberResults";
	var resultString = "<div class='form-group memberRow' id='userRow_" + (type ? type + "_" : "") + result.id + "'>";
	resultString += "<div class='col-xs-4 col-md-5 text-right'>" + (result.avatar_image.is_default ? "" : "<img src='" + result.avatar_image.url + "' class='avatarImg' />") + "</div>";
	resultString += "<div class='col-xs-4 col-md-2 text-center'>@" + result.username + (result.name ? "<br /><span class='realName'>" + result.name + "</span>" : "" ) + "</div>";
	resultString += "<div class='col-xs-4 col-md-5 text-left'>";
	if (type && type=="search") {
		//Should add a check for existing membership here.
		resultString += "<a class='btn btn-default btn-sm' href='#userSearch' title='Add member' onclick='addUser(" + result.id + ")'><i class='fa fa-plus'></i></a>";
		resultLocation = "div#searchResults";
	} else if (!type || type != "owner") {
		resultString += "<a class='btn btn-default btn-sm' href='#sectionSettings' title='Remove member' onclick='removeUser(" + result.id + ")'><i class='fa fa-times'></i></a>";
	}
	resultString += "</div></div>";
	$(resultLocation).append(resultString);
}

/* miscellaneous functions */

function checkLocalStorage() {
	if (localStorage && localStorage["accessToken"]) {
			//Retrieve the access token.
			try {api.accessToken = localStorage["accessToken"];} 
			catch (e) {}
	} else {
		api.accessToken = window.location.hash.split("access_token=")[1];
		if (api.accessToken && localStorage) {
			try {localStorage["accessToken"] = api.accessToken;} 
			catch (e) {}
		}
	}
}

function checkLocalStorageChannel(defaultChannel) {
	if (localStorage && localStorage["currentChannel"]) {
			//Retrieve the current channel.
			try {api.currentChannel = localStorage["currentChannel"];} 
			catch (e) {}
	} else {
		api.currentChannel = defaultChannel;
		if (api.currentChannel && localStorage) {
			try {localStorage["currentChannel"] = api.currentChannel;}
			catch (e) {}
		}
	}
}

function setLocalStorageChannel(newChannel) {
	api.currentChannel = newChannel;
	if (api.currentChannel && localStorage) {
		//Set the new channel.
		try {localStorage["currentChannel"] = api.currentChannel;}
		catch (e) {}
	}
}

function checkLocalStorageUser() {
	if (localStorage && localStorage["userId"]) {
			try {api.userId = localStorage["userId"];} 
			catch (e) {}
	} else {
		var promise = $.appnet.user.get("me");
		promise.then(setLocalStorageUser, function (response) {failAlert('Failed to retrieve user ID.');});
	}

	function setLocalStorageUser(response) {
		api.userId = response.data.id;
		if (api.userId && localStorage) {
			try {localStorage["userId"] = api.userId;} 
			catch (e) {}
		}
	}
}

function failAlert(msg) {
	//document.getElementById("errorDiv").scrollIntoView();
	//$('#errorDiv').html(msg).show().fadeOut(8000);
	alert(msg);
}

function forceScroll(hash) {
	var target = $(hash);
	$('html,body').animate({scrollTop: target.offset().top - 50}, 1000);
	//navbarSetter(hash);
	return false;
}

function initializeButtons() {
	$("span.settingsButton").click(function (event) {
		event.preventDefault();
		//forceScroll("#sectionSettings");
		$(event.target).closest("div.bucketListDiv").find(".settingsToggle").toggle();
		if ($(event.target).closest("div.bucketListDiv").find(".settingsToggle").length == 0)
			forceScroll("#sectionSettings");
	});
}

function logout() {
	//Erase token and lists.
	api.accessToken = '';
	if (localStorage) {
		try {
			localStorage.removeItem("accessToken");
		} catch (e) {}
	}

	$(".loggedIn").hide();
	$(".loggedOut").show();
	//Clear the lists.
	clearPage();
	//Erase the channel array.
	//...
}

function navbarSetter(hashSectionName) {
	$("div#navbar-collapsible ul li").removeClass("active");
	//Not sure I need this.
	//if (hashSectionName) 
	//	$("div#navbar-collapsible ul li a[href = hashSectionName]").addClass("active");
}

function pushHistory(newLocation) {
	if (history.pushState) 
		history.pushState({}, document.title, newLocation);
}

function toggleAbout() {
	$('.about').toggle();
	$('html, body').animate({scrollTop: '0px'}, 150);
	if ( $('#more').html() == "[more]" ) 
		 $('#more').html("[less]");
	else
		$('#more').html("[more]");
}

function updateChannels() {//manual channel repair for dev.
	/* Delete old annotation type
	$.appnet.channel.update(55870,{annotations:  [{ type: api.channel_type }] });
	$.appnet.channel.update(55871,{annotations:  [{ type: api.channel_type }] });
	$.appnet.channel.update(55872,{annotations:  [{ type: api.channel_type }] });
	 */
	/* add new annotation type
	$.appnet.channel.update(55870,{annotations:  [{ type: api.annotation_type, value: {'list_type': 'now'}}]});
	$.appnet.channel.update(55871,{annotations:  [{ type: api.annotation_type, value: {'list_type': 'later'}}]});
	$.appnet.channel.update(55872,{annotations:  [{ type: api.annotation_type, value: {'list_type': 'archive'}}]});
	 */
	/* insure list groups */
//	var promise = $.appnet.channel.update(55870,{annotations:  [{ type: api.annotation_type, value: {'list_type': 'now', 'list_group': '55870'}}]});
//	promise.then(completeUpdateChannels,  function (response) {failAlert('Failed to create grocery channel.');});
//	$.appnet.channel.update(55871,{annotations:  [{ type: api.annotation_type, value: {'list_type': 'later', 'list_group': '55870'}}]});
//	$.appnet.channel.update(55872,{annotations:  [{ type: api.annotation_type, value: {'list_type': 'archive', 'list_group': '55870'}}]});

	function completeUpdateChannels(response) {
		//
	}

	/* Type refactoring.
	$.appnet.channel.update(55870,{annotations:  [{ type: api.annotation_type, value: {'name': 'Kitchen Aids'}}]});
	$.appnet.channel.update(55871,{annotations:  [{ type: api.annotation_type, value: {'name': 'Shared Grocery List', 'list_types': {0: {'title': 'archive', 'subtitle':'The Deep Freeze'}, 1: {'title':'now', 'subtitle':'Urgent Items'}, 2: {'title':'later'}}}},{ type: api.message_annotation_type, value: {'lists': {0:['4804034'], 2:[4860095,4807241,4804056]}}} ]});
	$.appnet.channel.update(55872,{annotations:  [{ type: api.annotation_type, value: {'name': 'Online Shopping List'}}]});
	 */
	/* update just the lists lists
	$.appnet.channel.update(55871,{annotations:  [{ type: api.message_annotation_type, value: {'lists': {0:['4804034'], 2:['4860095','4807241','4804056']}}} ]});
	 */

	/* remove old writers
	$.appnet.channel.update(55870,{writers: {user_ids: []}});
	$.appnet.channel.update(55871,{writers: {user_ids: []}});
	$.appnet.channel.update(55872,{writers: {user_ids: []}});
	 */
}



/* eof */
