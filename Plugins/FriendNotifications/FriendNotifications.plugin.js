/**
 * @name FriendNotifications
 * @author DevilBro
 * @authorId 278543574059057154
 * @version 2.1.3
 * @description Shows a Notification when a Friend or a User, you choose to observe, changes their Status
 * @invite Jx3TjNS
 * @donate https://www.paypal.me/MircoWittrien
 * @patreon https://www.patreon.com/MircoWittrien
 * @website https://mwittrien.github.io/
 * @source https://github.com/mwittrien/BetterDiscordAddons/tree/master/Plugins/FriendNotifications/
 * @updateUrl https://mwittrien.github.io/BetterDiscordAddons/Plugins/FriendNotifications/FriendNotifications.plugin.js
 */

module.exports = (_ => {
	const changeLog = {
		
	};

	return !window.BDFDB_Global || (!window.BDFDB_Global.loaded && !window.BDFDB_Global.started) ? class {
		constructor (meta) {for (let key in meta) this[key] = meta[key];}
		getName () {return this.name;}
		getAuthor () {return this.author;}
		getVersion () {return this.version;}
		getDescription () {return `The Library Plugin needed for ${this.name} is missing. Open the Plugin Settings to download it. \n\n${this.description}`;}
		
		downloadLibrary () {
			BdApi.Net.fetch("https://mwittrien.github.io/BetterDiscordAddons/Library/0BDFDB.plugin.js").then(r => {
				if (!r || r.status != 200) throw new Error();
				else return r.text();
			}).then(b => {
				if (!b) throw new Error();
				else return require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0BDFDB.plugin.js"), b, _ => BdApi.UI.showToast("Finished downloading BDFDB Library", {type: "success"}));
			}).catch(error => {
				BdApi.UI.alert("Error", "Could not download BDFDB Library Plugin. Try again later or download it manually from GitHub: https://mwittrien.github.io/downloader/?library");
			});
		}
		
		load () {
			if (!window.BDFDB_Global || !Array.isArray(window.BDFDB_Global.pluginQueue)) window.BDFDB_Global = Object.assign({}, window.BDFDB_Global, {pluginQueue: []});
			if (!window.BDFDB_Global.downloadModal) {
				window.BDFDB_Global.downloadModal = true;
				BdApi.UI.showConfirmationModal("Library Missing", `The Library Plugin needed for ${this.name} is missing. Please click "Download Now" to install it.`, {
					confirmText: "Download Now",
					cancelText: "Cancel",
					onCancel: _ => {delete window.BDFDB_Global.downloadModal;},
					onConfirm: _ => {
						delete window.BDFDB_Global.downloadModal;
						this.downloadLibrary();
					}
				});
			}
			if (!window.BDFDB_Global.pluginQueue.includes(this.name)) window.BDFDB_Global.pluginQueue.push(this.name);
		}
		start () {this.load();}
		stop () {}
		getSettingsPanel () {
			let template = document.createElement("template");
			template.innerHTML = `<div style="color: var(--text-primary); font-size: 16px; font-weight: 300; white-space: pre; line-height: 22px;">The Library Plugin needed for ${this.name} is missing.\nPlease click <a style="font-weight: 500;">Download Now</a> to install it.</div>`;
			template.content.firstElementChild.querySelector("a").addEventListener("click", this.downloadLibrary);
			return template.content.firstElementChild;
		}
	} : (([Plugin, BDFDB]) => {
		var _this;
		var userStatusStore, timeLog, lastTimes, checkInterval;
		var friendCounter, timeLogList;
		var defaultSettings = {};
		var observedUsers = {};
		var paginationOffset = {};
		
		const statuses = {
			online: {
				value: true,
				name: "STATUS_ONLINE",
				sound: true
			},
			idle: {
				value: false,
				name: "STATUS_IDLE",
				sound: true
			},
			dnd: {
				value: false,
				name: "STATUS_DND",
				sound: true
			},
			playing: {
				value: false,
				checkActivity: true,
				specialStatus: true,
				sound: true
			},
			listening: {
				value: false,
				checkActivity: true,
				specialStatus: true,
				sound: true
			},
			streaming: {
				value: false,
				checkActivity: true,
				specialStatus: true,
				sound: true
			},
			screensharing: {
				value: false,
				specialStatus: true,
				sound: true
			},
			offline: {
				value: true,
				name: "STATUS_OFFLINE",
				sound: true
			},
			login: {
				value: false
			},
			mobile: {
				value: false
			},
			custom: {
				value: false
			}
		};
		
		const specialStatuses = Object.entries(statuses).filter(n => n[1].specialStatus).map(n => n[0]);
		
		const notificationTypes = {
			DISABLED: {
				button: null,
				value: 0,
				color: ""
			},
			TOAST: {
				button: 0,
				value: 1,
				color: "var(--bdfdb-blurple)"
			},
			DESKTOP: {
				button: 2,
				value: 2,
				color: "var(--status-positive)"
			}
		};
		
		const FriendOnlineCounterComponent = class FriendOnlineCounter extends BdApi.React.Component {
			componentDidMount() {
				friendCounter = this;
			}
			render() {
				return BDFDB.ReactUtils.createElement("div", {
					className: BDFDB.disCNS.guildouter + BDFDB.disCN._friendnotificationsfriendsonlinewrap,
					children: BDFDB.ReactUtils.createElement("div", {
						className: BDFDB.disCNS.guildslabel + BDFDB.disCN._friendnotificationsfriendsonline,
						children: BDFDB.LanguageUtils.LanguageStringsFormat("FRIENDS_ONLINE_HEADER", this.props.amount),
						onClick: _ => _this.showTimeLog()
					})
				});
			}
		};
		
		const TimeLogComponent = class TimeLog extends BdApi.React.Component {
			componentDidMount() {
				timeLogList = this;
			}
			render() {
				return this.props.entries.length ? BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.PaginatedList, {
					items: this.props.entries,
					amount: 50,
					copyToBottom: true,
					renderItem: (log, i) => [
						i > 0 ? BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.FormDivider, {
						className: BDFDB.disCNS.margintop8 + BDFDB.disCN.marginbottom8
						}) : null,
						BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
							align: BDFDB.LibraryComponents.Flex.Align.CENTER,
							children: [
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TextElement, {
									className: BDFDB.disCN._friendnotificationslogtime,
									children: BDFDB.LibraryComponents.DateInput.format(_this.settings.dates.logDate, log.timestamp)
								}),
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Avatars.Avatar, {
									className: BDFDB.disCN._friendnotificationslogavatar,
									src: log.avatar,
									size: BDFDB.LibraryComponents.AvatarConstants.AvatarSizes.SIZE_40
								}),
								_this.createStatusDot(log.status, log.mobile, {marginRight: 6}),
								BDFDB.ReactUtils.createElement("div", {
									className: BDFDB.disCN._friendnotificationslogcontent,
									children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TextElement, {
										children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TextScroller, {
											speed: 1,
											children: BDFDB.ReactUtils.elementToReact(BDFDB.DOMUtils.create(log.string))
										})
									})
								})
							]
						})
					]
				}) : BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.EmptyStateImage, {});
			}
		};
	
		return class FriendNotifications extends Plugin {
			onLoad () {
				_this = this;
				
				userStatusStore = {};
				timeLog = [];
				lastTimes = {};
				friendCounter = null;
				
				this.neverSyncData = true;

				this.defaults = {
					general: {
						addOnlineCount:			{value: true, 			description: "Adds an Online Friend Counter to the Server List (Click to open Time Log)"},
						showTimestamp:			{value: false, 			description: "Adds the Timestamp"},
						muteOnDND:			{value: false, 			description: "Does not notify you when you are in DnD Status"},
						openOnClick:			{value: false, 			description: "Opens the DM when you click a Notification"}
					},
					choices: {
						toastPosition:			{value: "right",		description: "Position of Toast Notifications",		items: "ToastPositions"}
					},
					notificationStrings: {
						online: 			{value: "$user changed status to '$status'"},
						idle: 				{value: "$user changed status to '$status'"},
						dnd: 				{value: "$user changed status to '$status'"},
						playing: 			{value: "$user started playing '$game'"},
						listening: 			{value: "$user started listening to '$song'"},
						streaming: 			{value: "$user started streaming '$game'"},
						screensharing: 			{value: "$user started screensharing"},
						offline: 			{value: "$user changed status to '$status'"},
						login: 				{value: "$user just logged in '$status'"},
						custom: 			{value: "$user changed status to '$custom'"}
					},
					notificationSounds: {},
					dates: {
						logDate:			{value: {}, 			description: "Log Timestamp"},
					},
					amounts: {
						toastTime:			{value: 5, 	min: 1,		description: "Amount of Seconds a Toast Notification stays on Screen: "},
						checkInterval:			{value: 10, 	min: 5,		description: "Checks Users every X Seconds: "}
					}
				};
			
				this.modulePatches = {
					after: [
						"UnreadDMs"
					]
				};
		
				this.css = `
					${BDFDB.dotCN._friendnotificationslogtime} {
						flex: 0 1 auto;
						min-width: 160px;
					}	
					${BDFDB.dotCN._friendnotificationslogavatar} {
						margin: 0 10px;
					}
					${BDFDB.dotCN._friendnotificationslogcontent} {
						max-width: 600px;
						overflow: hidden;
					}
					${BDFDB.dotCN._friendnotificationstypelabel} {
						border-radius: 3px;
						padding: 0 3px;
						margin: 0 6px;
					}
					${BDFDB.dotCN._friendnotificationsfriendsonline} {
						cursor: pointer;
					}
					${BDFDB.dotCNS._friendnotificationstimelogmodal + BDFDB.dotCN.messagespopoutemptyplaceholder} {
						position: absolute;
						bottom: 0;
						width: 100%;
					}
				`;
				
				for (let type in statuses) if (statuses[type].sound) {
					this.defaults.notificationSounds["toast" + type] = {value: {url: null, song: null, mute: false}};
					this.defaults.notificationSounds["desktop" + type] = {value: {url: null, song: null, mute: false}};
				}
			}
			
			onStart () {
				this.startInterval();

				this.forceUpdateAll();
			}
			
			onStop () {
				BDFDB.TimeUtils.clear(checkInterval);
				
				this.forceUpdateAll();
			}
			
			forceUpdateAll () {
				defaultSettings = Object.assign(BDFDB.ObjectUtils.map(statuses, status => notificationTypes[status.value ? "TOAST" : "DISABLED"].value), {timelog: true}, BDFDB.DataUtils.load(this, "defaultSettings"));
				
				BDFDB.DiscordUtils.rerenderAll();
			}

			getSettingsPanel (collapseStates = {}) {
				let changeAllConfigs = (type, config, notificationType) => {
					let observed = this.getObservedData();
					let specificObserved = observed[type] || {};
					if (config == "all") {
						config = "disabled";
						const value = notificationTypes[notificationType].button == 0 ? false : true;
						for (let id in specificObserved) specificObserved[id][config] = value;
					}
					else if (config == "timelog") {
						const value = notificationType == "TOAST" ? notificationTypes.TOAST.value : notificationTypes.DISABLED.value;
						for (let id in specificObserved) specificObserved[id][config] = value;
					}
					else {
						let disabled = BDFDB.ObjectUtils.toArray(specificObserved).every(d => !d.disabled && d[config] == notificationTypes[notificationType].value);
						for (let id in specificObserved) specificObserved[id][config] = notificationTypes[disabled ? "DISABLED" : notificationType].value;
					}
					observed[type] = specificObserved
					BDFDB.DataUtils.save(observed, this, "observed");
					this.SettingsUpdated = true;
					BDFDB.PluginUtils.refreshSettingsPanel(this, settingsPanel, collapseStates);
				};
				let successSavedAudio = (type, parsedData) => {
					if (parsedData) BDFDB.NotificationUtils.toast(`Sound was saved successfully.`, {type: "success"});
					this.settings.notificationSounds[type].song = parsedData;
					BDFDB.DataUtils.save(this.settings.notificationSounds, this, "notificationSounds");
					this.SettingsUpdated = true;
				};
				let createUserList = (users, type, title) => {
					let items = [];
					items.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
						className: BDFDB.disCNS.settingsrowtitle + BDFDB.disCN.cursordefault,
						children: [
							"Click on an Option to toggle",
							BDFDB.ReactUtils.createElement("span", {
								className: BDFDB.disCN._friendnotificationstypelabel,
								style: {backgroundColor: "var(--bdfdb-blurple)"},
								children: "Toast"
							}),
							"Notifications for that User"
						]
					}));
					if ("Notification" in window) items.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
						className: BDFDB.disCNS.settingsrowtitle + BDFDB.disCN.cursordefault,
						children: [
							"Right-Click on an Option to toggle",
							BDFDB.ReactUtils.createElement("span", {
								className: BDFDB.disCN._friendnotificationstypelabel,
								style: {backgroundColor: "var(--status-positive)"},
								children: "Desktop"
							}),
							"Notifications for that User"
						]
					}));
					items.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
						className: BDFDB.disCNS.settingsrowtitle + BDFDB.disCN.cursordefault,
						style: {marginTop: 6},
						children: [
							"Click on an Option Header to toggle",
							BDFDB.ReactUtils.createElement("span", {
								className: BDFDB.disCN._friendnotificationstypelabel,
								style: {backgroundColor: "var(--bdfdb-blurple)"},
								children: "Toast"
							}),
							"Notifications for all Users"
						]
					}));
					if ("Notification" in window) items.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
						className: BDFDB.disCNS.settingsrowtitle + BDFDB.disCN.cursordefault,
						children: [
							"Right-Click on an Option Header to toggle",
							BDFDB.ReactUtils.createElement("span", {
								className: BDFDB.disCN._friendnotificationstypelabel,
								style: {backgroundColor: "var(--status-positive)"},
								children: "Desktop"
							}),
							"Notifications for all Users"
						]
					}));
					items.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
						className: BDFDB.disCNS.settingsrowtitle + BDFDB.disCN.cursordefault,
						style: {marginTop: 6},
						children: "Click on an Avatar to toggle between enabled/disabled"
					}));
					if ("Notification" in window) items.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
						className: BDFDB.disCNS.settingsrowtitle + BDFDB.disCN.cursordefault,
						children: [
							"Right-Click on an Avatar to toggle all Options between",
							BDFDB.ReactUtils.createElement("span", {
								className: BDFDB.disCN._friendnotificationstypelabel,
								style: {backgroundColor: "var(--bdfdb-blurple)"},
								children: "Toast"
							}),
							"/",
							BDFDB.ReactUtils.createElement("span", {
								className: BDFDB.disCN._friendnotificationstypelabel,
								style: {backgroundColor: "var(--status-positive)"},
								children: "Desktop"
							})
						]
					}));
					items.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsList, {
						className: BDFDB.disCN.margintop20,
						title: "all",
						settings: Object.keys(statuses).concat("timelog"),
						data: users,
						pagination: {
							alphabetKey: "username",
							amount: 50,
							offset: paginationOffset[title] || 0,
							onJump: offset => paginationOffset[title] = offset
						},
						getCheckboxColor: value => {
							let color = (BDFDB.ObjectUtils.toArray(notificationTypes).find(n => n.value == value) || {}).color;
							return BDFDB.DiscordConstants.Colors[color] || color;
						},
						getCheckboxValue: (value, event, instance) => {
							if (instance && instance.props.settingId == "timelog") {
								return value == notificationTypes.DISABLED.value ? notificationTypes.TOAST.value : notificationTypes.DISABLED.value;
							}
							else {
								let eventValue = (BDFDB.ObjectUtils.toArray(notificationTypes).find(n => n.button == event.button) || {}).value;
								return eventValue == value ? 0 : eventValue;
							}
						},
						renderLabel: cardData => [
							BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Avatars.Avatar, {
								className: BDFDB.DOMUtils.formatClassName(BDFDB.disCN.listavatar, cardData.disabled && BDFDB.disCN.avatardisabled),
								src: BDFDB.UserUtils.getAvatar(cardData.id),
								status: BDFDB.UserUtils.getStatus(cardData.id),
								size: BDFDB.LibraryComponents.AvatarConstants.AvatarSizes.SIZE_40,
								onClick: _ => {
									let observed = this.getObservedData();
									let data = observed[type][cardData.id] || Object.assign({}, defaultSettings);
									data.disabled = !data.disabled;
									observed[type][data.id] = data;
									BDFDB.DataUtils.save(observed, this, "observed");
									this.SettingsUpdated = true;
									BDFDB.PluginUtils.refreshSettingsPanel(this, settingsPanel, collapseStates);
								},
								onContextMenu: _ => {
									let observed = this.getObservedData();
									let data = observed[type][cardData.id] || Object.assign({}, defaultSettings);
									let batchType;
									for (let config in statuses) {
										if (data[config] == notificationTypes.TOAST.value) batchType = notificationTypes.DESKTOP.value;
										else if (data[config] == notificationTypes.DESKTOP.value) batchType = notificationTypes.TOAST.value;
										if (batchType != undefined) break;
									}
									for (let config in statuses) if (data[config] != notificationTypes.DISABLED.value) data[config] = batchType;
									observed[type][data.id] = data;
									BDFDB.DataUtils.save(observed, this, "observed");
									this.SettingsUpdated = true;
									BDFDB.PluginUtils.refreshSettingsPanel(this, settingsPanel, collapseStates);
								}
							}),
							BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TextScroller, {
								children: cardData.globalName || cardData.username
							})
						],
						onHeaderClick: config => {
							changeAllConfigs(type, config, "TOAST");
						},
						onHeaderContextMenu: config => {
							changeAllConfigs(type, config, "DESKTOP");
						},
						onCheckboxChange: (value, instance) => {
							let observed = this.getObservedData();
							let data = observed[type][instance.props.cardId] || Object.assign({}, defaultSettings);
							data[instance.props.settingId] = value;
							observed[type][instance.props.cardId] = data;
							BDFDB.DataUtils.save(observed, this, "observed");
							this.SettingsUpdated = true;
						},
						noRemove: type == "friends",
						onRemove: (e, instance) => {
							let observed = this.getObservedData();
							delete observed[type][instance.props.cardId];
							BDFDB.DataUtils.save(observed, this, "observed");
							BDFDB.PluginUtils.refreshSettingsPanel(this, settingsPanel, collapseStates);
							this.SettingsUpdated = true;
						}
					}, true));
					return BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.CollapseContainer, {
						title: title,
						collapseStates: collapseStates,
						dividerTop: true,
						children: items
					});
				};
				
				let settingsPanel;
				return settingsPanel = BDFDB.PluginUtils.createSettingsPanel(this, {
					collapseStates: collapseStates,
					children: _ => {
						let settingsItems = [];
						
						let observed = this.getObservedData();
						let friendIds = BDFDB.LibraryStores.RelationshipStore.getFriendIDs();
						
						settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.CollapseContainer, {
							title: "Settings",
							collapseStates: collapseStates,
							children: [
								Object.keys(this.defaults.general).map(key => BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsSaveItem, {
									type: "Switch",
									plugin: this,
									keys: ["general", key],
									label: this.defaults.general[key].description,
									value: this.settings.general[key]
								})),
								Object.keys(this.defaults.choices).map(key => BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsSaveItem, {
									type: "Select",
									plugin: this,
									keys: ["choices", key],
									label: this.defaults.choices[key].description,
									basis: "50%",
									value: this.settings.choices[key],
									options: Object.keys(BDFDB.DiscordConstants[this.defaults.choices[key].items] || {}).map(p => ({
										value: p,
										label: BDFDB.LanguageUtils.LibraryStrings[p] || p
									})),
									searchable: true
								})),
								Object.keys(this.defaults.dates).map(key => BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.DateInput, {
									...(this.settings.dates[key] || {}),
									label: this.defaults.dates[key].description,
									onChange: valueObj => {
										this.SettingsUpdated = true;
										this.settings.dates[key] = valueObj;
										BDFDB.DataUtils.save(this.settings.dates, this, "dates");
									}
								})),
								Object.keys(this.defaults.amounts).map(key => (key.indexOf("desktop") == -1 || "Notification" in window) && BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsSaveItem, {
									type: "TextInput",
									childProps: {
										type: "number"
									},
									plugin: this,
									keys: ["amounts", key],
									label: this.defaults.amounts[key].description,
									basis: "20%",
									min: this.defaults.amounts[key].min,
									max: this.defaults.amounts[key].max,
									value: this.settings.amounts[key]
								}))
							]
						}));
						
						settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.CollapseContainer, {
							title: "Default Settings for new Users",
							collapseStates: collapseStates,
							children: ["disabled"].concat(Object.keys(defaultSettings)).map(key => BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsItem, {
								type: "Switch",
								label: BDFDB.StringUtils.upperCaseFirstChar(key),
								value: !!defaultSettings[key],
								onChange: value => {
									defaultSettings[key] = !!statuses[key] ? notificationTypes[value ? "TOAST" : "DISABLED"].value : value;
									BDFDB.DataUtils.save(defaultSettings, this, "defaultSettings");
								}
							}))
						}));
						
						let friendCards = Object.keys(observed.friends).map(BDFDB.LibraryStores.UserStore.getUser).filter(n => n);
						let strangerCards = Object.keys(observed.strangers).map(BDFDB.LibraryStores.UserStore.getUser).filter(n => n);
						
						if (friendCards.length) settingsItems.push(createUserList(friendCards.map(user => Object.assign({}, user, observed.friends[user.id], {
							key: user.id,
							className: observed.friends[user.id].disabled ? BDFDB.disCN.hovercarddisabled : ""
						})), "friends", "Friend-List"));
						
						let strangerId = "";
						settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.CollapseContainer, {
							title: "Add new Stranger",
							collapseStates: collapseStates,
							children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
								className: BDFDB.disCN.margintop8,
								align: BDFDB.LibraryComponents.Flex.Align.CENTER,
								children: [
									BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex.Child, {
										children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TextInput, {
											placeholder: "user (id or accountname)",
											value: "",
											onChange: value => strangerId = value
										})
									}),
									BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Button, {
										onClick: _ => {
											let userId = strangerId.trim();
											if (userId == BDFDB.UserUtils.me.id) BDFDB.NotificationUtils.toast("Are you seriously trying to observe yourself?", {type: "danger"});
											else if (friendIds.includes(userId)) BDFDB.NotificationUtils.toast("User is already a Friend of yours, please use the 'Friend-List' Area to configure them", {type: "danger"});
											else if (observed.strangers[userId]) BDFDB.NotificationUtils.toast("User is already being observed as a 'Stranger'", {type: "danger"});
											else {
												let user = /.+#[0-9]{4}/.test(userId) ? BDFDB.LibraryStores.UserStore.findByTag(userId.split("#").slice(0, -1).join("#"), userId.split("#").pop()) : (BDFDB.LibraryStores.UserStore.findByTag(userId) || BDFDB.LibraryStores.UserStore.getUser(userId));
												if (user) {
													if (user.id == BDFDB.UserUtils.me.id) BDFDB.NotificationUtils.toast("Are you seriously trying to observe yourself?", {type: "danger"});
													else {
														observed.strangers[user.id || userId] = Object.assign({}, defaultSettings);
														BDFDB.DataUtils.save(observed, this, "observed");
														BDFDB.PluginUtils.refreshSettingsPanel(this, settingsPanel, collapseStates);
														this.SettingsUpdated = true;
													}
												}
												else BDFDB.NotificationUtils.toast("Please enter a valid ID or Accountname of a User that has been loaded in your Client", {type: "danger"});
											}
										},
										children: BDFDB.LanguageUtils.LanguageStrings.ADD
									})
								]
							})
						}));
						
						if (strangerCards.length) settingsItems.push(createUserList(strangerCards.map(user => Object.assign({}, user, observed.strangers[user.id], {
							key: user.id,
							className: observed.strangers[user.id].disabled ? BDFDB.disCN.hovercarddisabled : ""
						})), "strangers", "Stranger-List"));
						
						settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.CollapseContainer, {
							title: "Notification Messages",
							collapseStates: collapseStates,
							children: [BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
								className: BDFDB.disCN.marginbottom8,
								children: BDFDB.ReactUtils.createElement("div", {
									className: BDFDB.disCNS.settingsrowtitle + BDFDB.disCN.cursordefault,
									children: [
										"Allows you to configure your own Message Strings for the different Statuses.",
										[
											["$user", " is the Placeholder for the Username"],
											["$nick", " for the Friend Nickname (fallback to $user if unused)"],
											["$status", " for the Status Name"],
											["$statusOld", " for the previous Status Name"],
											["$custom", " for the Custom Status"],
											["$game", " for the Game Name"],
											["$song", " for the Song Name"],
											["$artist", " for the Song Artist"]
										].map(n => BDFDB.ReactUtils.createElement("div", {children: [
											BDFDB.ReactUtils.createElement("strong", {children: n[0]}),
											n[1]
										]}))
									]
								})
							})].concat(Object.keys(this.defaults.notificationStrings).map(key => BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsSaveItem, {
								type: "TextInput",
								plugin: this,
								keys: ["notificationStrings", key],
								placeholder: this.defaults.notificationStrings[key].value,
								label: BDFDB.StringUtils.upperCaseFirstChar(key),
								basis: "80%",
								value: this.settings.notificationStrings[key]
							})))
						}));
						
						settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.CollapseContainer, {
							title: "Notification Sounds",
							collapseStates: collapseStates,
							children: Object.keys(this.defaults.notificationSounds).map((key, i) => (key.indexOf("desktop") == -1 || "Notification" in window) && [
								i != 0 && key.indexOf("toast") == 0 && BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.FormDivider, {
									className: BDFDB.disCN.marginbottom8
								}),
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
									className: BDFDB.disCN.marginbottom8,
									align: BDFDB.LibraryComponents.Flex.Align.CENTER,
									direction: BDFDB.LibraryComponents.Flex.Direction.HORIZONTAL,
									children: [
										BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsLabel, {
											label: `${key.split(/(desktop)|(toast)/).filter(n => n).map(n => BDFDB.StringUtils.upperCaseFirstChar(n)).join("-")} Notification Sound`,
										}),
										BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsItem, {
											type: "Switch",
											mini: true,
											grow: 0,
											label: "Mute:",
											value: this.settings.notificationSounds[key].mute,
											onChange: value => {
												this.settings.notificationSounds[key].mute = value;
												BDFDB.DataUtils.save(this.settings.notificationSounds, this, "notificationSounds");
											}
										})
									].filter(n => n)
								}),
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
									className: BDFDB.disCN.marginbottom8,
									align: BDFDB.LibraryComponents.Flex.Align.CENTER,
									children: [
										BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex.Child, {
											children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TextInput, {
												className: `input-${key}src`,
												type: "file",
												filter: ["audio", "video"],
												placeholder: "Url or File",
												value: this.settings.notificationSounds[key].song
											})
										}),
										BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Button, {
											onClick: _ => {
												let source = settingsPanel.props._node.querySelector(`.input-${key}src ` + BDFDB.dotCN.input);
												let value = source && (source.getAttribute("file") || source.value).trim()
												if (!value.length) {
													BDFDB.NotificationUtils.toast(`Sound File was removed.`, {type: "warning"});
													successSavedAudio(key, value);
												}
												else if (value.indexOf("http") == 0) BDFDB.LibraryRequires.request(value, (error, response, result) => {
													if (response) {
														let type = response.headers["content-type"];
														if (type && (type.indexOf("octet-stream") > -1 || type.indexOf("audio") > -1 || type.indexOf("video") > -1)) {
															successSavedAudio(key, value);
															return;
														}
													}
													BDFDB.NotificationUtils.toast("Use a valid direct Link to a Video or Audio Source, they usually end on something like .mp3, .mp4 or .wav", {type: "danger"});
												});
												else if (value.indexOf("data:") == 0) return successSavedAudio(key, value);
											},
											children: BDFDB.LanguageUtils.LanguageStrings.SAVE
										})
									]
								})
							]).flat(10).filter(n => n)
						}));
						
						settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.CollapseContainer, {
							title: "LogIn/-Out Timelog",
							collapseStates: collapseStates,
							children: BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsItem, {
								type: "Button",
								label: "Overview of LogIns/-Outs of current Session",
								onClick: _ => this.showTimeLog(),
								children: "Timelog"
							})
						}));
						
						return settingsItems;
					}
				});
			}

			onSettingsClosed () {
				if (this.SettingsUpdated) {
					delete this.SettingsUpdated;
					
					this.startInterval();
					this.forceUpdateAll();
				}
			}
			
			processUnreadDMs (e) {
				if (!this.settings.general.addOnlineCount) return;
				e.returnvalue = [e.returnvalue].flat(10);
				e.returnvalue.unshift(BDFDB.ReactUtils.createElement(FriendOnlineCounterComponent, {
					amount: this.getOnlineCount()
				}));
			}
			
			getObservedData () {
				let observed = Object.assign({friends: {}, strangers: {}}, BDFDB.DataUtils.load(this, "observed"));
				let friendIds = BDFDB.LibraryStores.RelationshipStore.getFriendIDs();
				
				for (let id of friendIds) {
					let user = BDFDB.LibraryStores.UserStore.getUser(id);
					if (user) {
						observed.friends[id] = Object.assign({}, defaultSettings, observed.friends[id] || observed.strangers[id]);
						delete observed.strangers[id];
					}
				}
				for (let id in observed.friends) if (!friendIds.includes(id)) {
					observed.strangers[id] = Object.assign({}, observed.friends[id]);
					delete observed.friends[id];
				}
				
				delete observed.friends[BDFDB.UserUtils.me.id];
				delete observed.strangers[BDFDB.UserUtils.me.id];
				BDFDB.DataUtils.save(observed, this, "observed");
				
				return observed;
			}

			getStatusWithMobileAndActivity (id, config, clientStatuses) {
				let voiceState = BDFDB.LibraryStores.SortedGuildStore.getFlattenedGuildIds().map(BDFDB.LibraryStores.SortedVoiceStateStore.getVoiceStates).map(BDFDB.ObjectUtils.toArray).flat(10).map(n => n.voiceState || n).find(n => n.selfStream & n.userId == id && BDFDB.LibraryStores.ChannelStore.getChannel(n.channelId) && BDFDB.UserUtils.can("VIEW_CHANNEL", BDFDB.UserUtils.me.id, n.channelId));
				let status = {
					name: BDFDB.UserUtils.getStatus(id),
					activity: null,
					custom: false,
					screensharing: voiceState ? voiceState.channelId : null,
					mobile: clientStatuses && clientStatuses[id] && Object.keys(clientStatuses[id]).length == 1 && !!clientStatuses[id].mobile
				};
				let activity = BDFDB.UserUtils.getActivity(id) || BDFDB.UserUtils.getCustomStatus(id);
				if (activity && BDFDB.DiscordConstants.ActivityTypes[activity.type]) {
					let isCustom = activity.type == BDFDB.DiscordConstants.ActivityTypes.CUSTOM_STATUS;
					let activityName = isCustom ? "custom" : BDFDB.DiscordConstants.ActivityTypes[activity.type].toLowerCase();
					if (statuses[activityName] && config[activityName]) {
						Object.assign(status, {activity: Object.assign({}, activity), custom: isCustom, [activityName]: true});
						if (activity.type == BDFDB.DiscordConstants.ActivityTypes.STREAMING || activity.type == BDFDB.DiscordConstants.ActivityTypes.LISTENING) delete status.activity.name;
						else if (activity.type == BDFDB.DiscordConstants.ActivityTypes.PLAYING) {
							delete status.activity.details;
							delete status.activity.state;
						}
					}
				}
				return status;
			}
			
			getStatusName (id, status) {
				if (!status) return "";
				let statusName = (BDFDB.LanguageUtils.LanguageStringsCheck[statuses[status.name].name] && BDFDB.LanguageUtils.LanguageStrings[statuses[status.name].name] || this.labels["status_" + status.name] || statuses[status.name].name || "").toLowerCase();
				return statusName;
			}
			
			activityIsSame (id, status) {
				return BDFDB.equals(BDFDB.ObjectUtils.extract(userStatusStore[id].activity, "name", "details", "state", "emoji"), status && BDFDB.ObjectUtils.extract(status.activity, "name", "details", "state", "emoji"));
			}
			
			getOnlineCount () {
				return Array.from(BDFDB.LibraryStores.RelationshipStore.getMutableRelationships()).filter(n => n[1] == BDFDB.DiscordConstants.RelationshipTypes.FRIEND && BDFDB.LibraryStores.PresenceStore.getStatus(n[0]) != BDFDB.LibraryComponents.StatusComponents.Types.OFFLINE).length;
			}

			startInterval () {
				BDFDB.TimeUtils.clear(checkInterval);
				
				let data = this.getObservedData();
				observedUsers = Object.assign({}, data.strangers, data.friends);
				delete observedUsers[BDFDB.UserUtils.me.id];
				
				let clientStatuses = BDFDB.LibraryStores.PresenceStore.getState().clientStatuses;
				for (let id in observedUsers) userStatusStore[id] = this.getStatusWithMobileAndActivity(id, observedUsers[id], clientStatuses);
				
				checkInterval = BDFDB.TimeUtils.interval(_ => {
					let amount = this.getOnlineCount();
					if (friendCounter && friendCounter.props.amount != amount) {
						friendCounter.props.amount = amount;
						BDFDB.ReactUtils.forceUpdate(friendCounter);
					}
					clientStatuses = BDFDB.LibraryStores.PresenceStore.getState().clientStatuses;
					for (let id in observedUsers) if (!observedUsers[id].disabled) {
						let user = BDFDB.LibraryStores.UserStore.getUser(id);
						let status = this.getStatusWithMobileAndActivity(id, observedUsers[id], clientStatuses);
						let transitionChannelId = null;
						let customChanged = false, loginNotice = false, specialNotice = false;
						if (user && (!observedUsers[id][status.name] && observedUsers[id].login && status.name != BDFDB.LibraryComponents.StatusComponents.Types.OFFLINE && userStatusStore[id].name == BDFDB.LibraryComponents.StatusComponents.Types.OFFLINE && (loginNotice = true) || observedUsers[id][status.name] && (
							observedUsers[id].custom && (
								userStatusStore[id].custom != status.custom && ((customChanged = status.custom) || true) ||
								(customChanged = status.custom && !this.activityIsSame(id, status))
							) ||
							specialStatuses.some(special => observedUsers[id][special] && status[special] && userStatusStore[id][special] != status[special] && (specialNotice = special)) ||
							observedUsers[id].mobile && userStatusStore[id].mobile != status.mobile ||
							statuses[status.name].checkActivity && !this.activityIsSame(id, status) ||
							userStatusStore[id].name != status.name
						))) {
							let EUdata = BDFDB.BDUtils.isPluginEnabled("EditUsers") && BDFDB.DataUtils.load("EditUsers", "users", user.id) || {};
							let name = EUdata.name || user.globalName || user.username;
							let nickname = EUdata.name || BDFDB.LibraryStores.RelationshipStore.getNickname(user.id);
							let avatar = EUdata.removeIcon ? "" : (EUdata.url || BDFDB.UserUtils.getAvatar(user.id));
							let timestamp = new Date().getTime();
							
							let statusName = this.getStatusName(id, status);
							let oldStatusName = this.getStatusName(id, userStatusStore[id]);
							
							let string = this.settings.notificationStrings[specialNotice ? specialNotice : customChanged ? "custom" : loginNotice ? "login" : status.name] || "'$user' changed status to '$status'";
							let hasUserPlaceholder = string.indexOf("$user") > -1;
							let toastString = BDFDB.StringUtils.htmlEscape(string)
								.replace(/'{0,1}\$user'{0,1}/g, `<strong>${BDFDB.StringUtils.htmlEscape(name)}</strong>`)
								.replace(/'{0,1}\$nick'{0,1}/g, nickname ? `<strong>${BDFDB.StringUtils.htmlEscape(nickname)}</strong>` : !hasUserPlaceholder ? `<strong>${BDFDB.StringUtils.htmlEscape(name)}</strong>` : "")
								.replace(/'{0,1}\$statusOld'{0,1}/g, `<strong>${oldStatusName}</strong>`)
								.replace(/'{0,1}\$status'{0,1}/g, `<strong>${statusName}</strong>`);
							if (status.activity) {
								toastString = toastString
									.replace(/'{0,1}\$song'{0,1}|'{0,1}\$game'{0,1}/g, `<strong>${status.activity.name || status.activity.details || ""}</strong>`)
									.replace(/'{0,1}\$artist'{0,1}|'{0,1}\$custom'{0,1}/g, `<strong>${[status.activity.emoji && status.activity.emoji.name, status.activity.state].filter(n => n).join(" ") || ""}</strong>`);
							}
							
							let statusType = BDFDB.UserUtils.getStatus(user.id);
							if (observedUsers[id].timelog == undefined || observedUsers[id].timelog) timeLog.unshift({
								string: toastString,
								avatar: avatar,
								id: id,
								name: name,
								status: statusType,
								mobile: status.mobile,
								timestamp: timestamp
							});
							
							if (!(this.settings.general.muteOnDND && BDFDB.UserUtils.getStatus() == BDFDB.LibraryComponents.StatusComponents.Types.DND) && (!lastTimes[user.id] || lastTimes[user.id] != timestamp)) {
								lastTimes[user.id] = timestamp;
								
								let openChannel = _ => {
									if (this.settings.general.openOnClick) {
										if (status.screensharing) {
											BDFDB.LibraryModules.ChannelUtils.selectVoiceChannel(status.screensharing);
											BDFDB.LibraryModules.WindowUtils.focus();
										}
										else {
											let DMid = BDFDB.LibraryStores.ChannelStore.getDMFromUserId(user.id)
											if (DMid) BDFDB.LibraryModules.ChannelUtils.selectPrivateChannel(DMid);
											else BDFDB.LibraryModules.PrivateChannelUtils.getDMChannel(user.id).then(BDFDB.LibraryModules.ChannelUtils.selectPrivateChannel);
										}
									}
								};
								if ((loginNotice ? observedUsers[id].login : observedUsers[id][status.name]) == notificationTypes.DESKTOP.value) {
									let desktopString = string.replace(/\$user/g, name).replace(/\$statusOld/g, oldStatusName).replace(/\$status/g, statusName);
									if (status.activity) desktopString = desktopString.replace(/\$song|\$game/g, status.activity.name || status.activity.details || "").replace(/\$artist|\$custom/g, [status.activity.emoji && status.activity.emoji.name, status.activity.state].filter(n => n).join(" ") || "");
									if (status.mobile) desktopString += " (mobile)";
									let notificationSound = this.settings.notificationSounds["desktop" + status.name] || {};
									BDFDB.NotificationUtils.desktop([desktopString, this.settings.general.showTimeLog && BDFDB.LibraryComponents.DateInput.format(this.settings.dates.logDate, timestamp)].filter(n => n).join("\n\n"), {
										icon: avatar,
										silent: notificationSound.mute,
										sound: notificationSound.song,
										onClick: openChannel
									});
								}
								else BDFDB.NotificationUtils.toast(BDFDB.ReactUtils.createElement("div", {
									children: [
										BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Flex, {
											align: BDFDB.LibraryComponents.Flex.Align.CENTER,
											children: [
												BDFDB.ReactUtils.elementToReact(BDFDB.DOMUtils.create(toastString)),
												this.createStatusDot(statusType, status.mobile, {marginLeft: 6})
											]
										}),
										this.settings.general.showTimestamp && BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TextElement, {
											className: BDFDB.disCN.margintop4,
											size: BDFDB.LibraryComponents.TextElement.Sizes.SIZE_12,
											color: BDFDB.LibraryComponents.TextElement.Colors.MUTED,
											children: BDFDB.LibraryComponents.DateInput.format(this.settings.dates.logDate, timestamp)
										})
									]
								}), {
									timeout: this.settings.amounts.toastTime * 1000,
									avatar: avatar,
									barColor: BDFDB.UserUtils.getStatusColor(status.name, true),
									position: this.settings.choices.toastPosition,
									onClick: openChannel,
									onShow: _ => {
										let notificationSound = this.settings.notificationSounds["toast" + status.name] || {};
										if (!notificationSound.mute && notificationSound.song) {
											let audio = new Audio();
											audio.src = notificationSound.song;
											audio.play();
										}
									}
								});
							}
						}
						userStatusStore[id] = status;
					}
				}, this.settings.amounts.checkInterval * 1000);
			}
			
			createStatusDot (status, isMobile, style = {}) {
				return BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.StatusComponents.Status, {
					style: Object.assign({}, style),
					size: 12,
					color: isMobile ? BDFDB.UserUtils.getStatusColor(status, true) : null,
					isMobile: isMobile,
					status: isMobile ? BDFDB.LibraryComponents.StatusComponents.Types.ONLINE : status
				});
			}

			showTimeLog () {
				let searchTimeout;
				BDFDB.ModalUtils.open(this, {
					size: "MEDIUM",
					header: "LogIn/-Out Timelog",
					subHeader: "",
					className: BDFDB.disCN._friendnotificationstimelogmodal,
					titleChildren: [
						BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.Button, {
							color: BDFDB.LibraryComponents.Button.Colors.RED,
							size: BDFDB.LibraryComponents.Button.Sizes.TINY,
							look: BDFDB.LibraryComponents.Button.Looks.OUTLINE,
							style: {marginLeft: 6, marginRight: 12},
							children: BDFDB.LanguageUtils.LanguageStrings.BUILD_OVERRIDE_CLEAR,
							onClick: _ => BDFDB.ModalUtils.confirm(this, this.labels.clear_log, _ => {
								timeLog = [];
								timeLogList.props.entries = timeLog;
								BDFDB.ReactUtils.forceUpdate(timeLogList);
							})
						}),
						BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SearchBar, {
							autoFocus: true,
							query: "",
							onChange: value => {
								BDFDB.TimeUtils.clear(searchTimeout);
								searchTimeout = BDFDB.TimeUtils.timeout(_ => {
									let searchString = value.toUpperCase();
									timeLogList.props.entries = timeLog.filter(n => n && n.name && n.name.toUpperCase().indexOf(searchString) > -1);
									BDFDB.ReactUtils.forceUpdate(timeLogList);
								}, 1000);
							},
							onClear: _ => {
								timeLogList.props.entries = timeLog;
								BDFDB.ReactUtils.forceUpdate(timeLogList);
							}
						})
					],
					children: BDFDB.ReactUtils.createElement(TimeLogComponent, {
						entries: timeLog
					})
				});
			}

			setLabelsByLanguage () {
				switch (BDFDB.LanguageUtils.getLanguage().id) {
					case "bg":		// Bulgarian
						return {
							clear_log:						"Наистина ли искате да изчистите дневника на времето?",
							status_listening:					"Слушане",
							status_playing:						"Играе"
						};
					case "da":		// Danish
						return {
							clear_log:						"Er du sikker på, at du vil rydde tidsloggen?",
							status_listening:					"Hører efter",
							status_playing:						"Spiller"
						};
					case "de":		// German
						return {
							clear_log:						"Möchtest du das Zeitprotokoll wirklich löschen?",
							status_listening:					"Hören",
							status_playing:						"Spielen"
						};
					case "el":		// Greek
						return {
							clear_log:						"Είστε βέβαιοι ότι θέλετε να διαγράψετε το ημερολόγιο ώρας;",
							status_listening:					"Ακούγοντας",
							status_playing:						"Παιχνίδι"
						};
					case "es":		// Spanish
						return {
							clear_log:						"¿Está seguro de que desea borrar el registro de tiempo?",
							status_listening:					"Escuchando",
							status_playing:						"Jugando"
						};
					case "fi":		// Finnish
						return {
							clear_log:						"Haluatko varmasti tyhjentää aikalokin?",
							status_listening:					"Kuunteleminen",
							status_playing:						"Pelataan"
						};
					case "fr":		// French
						return {
							clear_log:						"Voulez-vous vraiment effacer le journal de temps?",
							status_listening:					"Écoute",
							status_playing:						"En jouant"
						};
					case "hr":		// Croatian
						return {
							clear_log:						"Jeste li sigurni da želite očistiti vremenski zapisnik?",
							status_listening:					"Slušanje",
							status_playing:						"Sviranje"
						};
					case "hu":		// Hungarian
						return {
							clear_log:						"Biztosan törli az időnaplót?",
							status_listening:					"Hallgatás",
							status_playing:						"Játék"
						};
					case "it":		// Italian
						return {
							clear_log:						"Sei sicuro di voler cancellare il registro del tempo?",
							status_listening:					"Ascoltando",
							status_playing:						"Giocando"
						};
					case "ja":		// Japanese
						return {
							clear_log:						"タイムログをクリアしてもよろしいですか？",
							status_listening:					"聞いている",
							status_playing:						"遊ぶ"
						};
					case "ko":		// Korean
						return {
							clear_log:						"시간 로그를 지우시겠습니까?",
							status_listening:					"청취",
							status_playing:						"놀이"
						};
					case "lt":		// Lithuanian
						return {
							clear_log:						"Ar tikrai norite išvalyti laiko žurnalą?",
							status_listening:					"Klausymas",
							status_playing:						"Žaidžia"
						};
					case "nl":		// Dutch
						return {
							clear_log:						"Weet u zeker dat u het tijdlogboek wilt wissen?",
							status_listening:					"Luisteren",
							status_playing:						"Spelen"
						};
					case "no":		// Norwegian
						return {
							clear_log:						"Er du sikker på at du vil slette tidsloggen?",
							status_listening:					"Lytte",
							status_playing:						"Spiller"
						};
					case "pl":		// Polish
						return {
							clear_log:						"Czy na pewno chcesz wyczyścić dziennik czasu?",
							status_listening:					"Słuchający",
							status_playing:						"Gra"
						};
					case "pt-BR":	// Portuguese (Brazil)
						return {
							clear_log:						"Tem certeza de que deseja limpar o registro de horas?",
							status_listening:					"Ouvindo",
							status_playing:						"Jogando"
						};
					case "ro":		// Romanian
						return {
							clear_log:						"Sigur doriți să ștergeți jurnalul de timp?",
							status_listening:					"Ascultare",
							status_playing:						"Joc"
						};
					case "ru":		// Russian
						return {
							clear_log:						"Вы уверены, что хотите очистить журнал времени?",
							status_listening:					"Прослушивание",
							status_playing:						"Играет"
						};
					case "sv":		// Swedish
						return {
							clear_log:						"Är du säker på att du vill rensa tidsloggen?",
							status_listening:					"Lyssnande",
							status_playing:						"Spelar"
						};
					case "th":		// Thai
						return {
							clear_log:						"แน่ใจไหมว่าต้องการล้างบันทึกเวลา",
							status_listening:					"การฟัง",
							status_playing:						"กำลังเล่น"
						};
					case "tr":		// Turkish
						return {
							clear_log:						"Zaman kaydını temizlemek istediğinizden emin misiniz?",
							status_listening:					"Dinleme",
							status_playing:						"Çalma"
						};
					case "uk":		// Ukrainian
						return {
							clear_log:						"Ви впевнені, що хочете очистити журнал часу?",
							status_listening:					"Слухання",
							status_playing:						"Гра"
						};
					case "vi":		// Vietnamese
						return {
							clear_log:						"Bạn có chắc chắn muốn xóa nhật ký thời gian không?",
							status_listening:					"Lắng nghe",
							status_playing:						"Đang chơi"
						};
					case "zh-CN":	// Chinese (China)
						return {
							clear_log:						"您确定要清除时间记录吗？",
							status_listening:					"聆听中",
							status_playing:						"游戏中"
						};
					case "zh-TW":	// Chinese (Taiwan)
						return {
							clear_log:						"您確定要清除時間記錄嗎？",
							status_listening:					"聆聽中",
							status_playing:						"遊戲中"
						};
					default:		// English
						return {
							clear_log:						"Are you sure you want to clear the timelog?",
							status_listening:					"Listening",
							status_playing:						"Playing"
						};
				}
			}
		};
	})(window.BDFDB_Global.PluginUtils.buildPlugin(changeLog));
})();
