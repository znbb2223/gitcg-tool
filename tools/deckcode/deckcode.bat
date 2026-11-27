@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "ALPH=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
set "MAP=%~dp0deckcode-map-v2.txt"
if not exist "%MAP%" call :write_map
set "ALL="
for /f "usebackq tokens=1,2,3 delims=:" %%a in ("%MAP%") do set "S_%%a=%%b"& set "R_%%b=%%a"& set "N_%%a=%%c"& set "ALL=!ALL! %%a"
goto menu

:write_map
> "%MAP%" echo 1101:1:\u7518\u96e8
>> "%MAP%" echo 1102:2:\u8fea\u5965\u5a1c
>> "%MAP%" echo 1103:3:\u51ef\u4e9a
>> "%MAP%" echo 1104:4:\u91cd\u4e91
>> "%MAP%" echo 1105:5:\u795e\u91cc\u7eeb\u534e
>> "%MAP%" echo 1106:6:\u4f18\u83c8
>> "%MAP%" echo 1107:7:\u7533\u9e64
>> "%MAP%" echo 1108:8:\u4e03\u4e03
>> "%MAP%" echo 1109:279:\u83b1\u4f9d\u62c9
>> "%MAP%" echo 1110:334:\u590f\u6d1b\u8482
>> "%MAP%" echo 1111:363:\u83b1\u6b27\u65af\u5229
>> "%MAP%" echo 1112:407:\u83f2\u7c73\u5c3c
>> "%MAP%" echo 1113:432:\u7f57\u838e\u8389\u4e9a
>> "%MAP%" echo 1114:477:\u831c\u7279\u83c8\u8389
>> "%MAP%" echo 1115:533:\u7231\u53ef\u83f2
>> "%MAP%" echo 1116:544:\u4e1d\u67ef\u514b
>> "%MAP%" echo 1117:555:\u7c73\u5361
>> "%MAP%" echo 1201:9:\u82ad\u82ad\u62c9
>> "%MAP%" echo 1202:10:\u884c\u79cb
>> "%MAP%" echo 1203:11:\u83ab\u5a1c
>> "%MAP%" echo 1204:12:\u8fbe\u8fbe\u5229\u4e9a
>> "%MAP%" echo 1205:13:\u73ca\u745a\u5bab\u5fc3\u6d77
>> "%MAP%" echo 1206:14:\u795e\u91cc\u7eeb\u4eba
>> "%MAP%" echo 1207:15:\u574e\u8482\u4e1d
>> "%MAP%" echo 1208:16:\u59ae\u9732
>> "%MAP%" echo 1209:280:\u591c\u5170
>> "%MAP%" echo 1210:335:\u90a3\u7ef4\u83b1\u7279
>> "%MAP%" echo 1211:364:\u8299\u5b81\u5a1c
>> "%MAP%" echo 1213:433:\u5e0c\u683c\u96ef
>> "%MAP%" echo 1214:444:\u739b\u62c9\u59ae
>> "%MAP%" echo 1215:570:\u5854\u5229\u96c5
>> "%MAP%" echo 1216:571:\u7231\u8bfa
>> "%MAP%" echo 1217:620:\u54e5\u4f26\u6bd4\u5a05
>> "%MAP%" echo 1301:17:\u8fea\u5362\u514b
>> "%MAP%" echo 1302:18:\u9999\u83f1
>> "%MAP%" echo 1303:19:\u73ed\u5c3c\u7279
>> "%MAP%" echo 1304:20:\u5b89\u67cf
>> "%MAP%" echo 1305:21:\u5bb5\u5bab
>> "%MAP%" echo 1306:22:\u53ef\u8389
>> "%MAP%" echo 1307:23:\u80e1\u6843
>> "%MAP%" echo 1308:24:\u70df\u7eef
>> "%MAP%" echo 1309:25:\u8fea\u5e0c\u96c5
>> "%MAP%" echo 1310:281:\u6797\u5c3c
>> "%MAP%" echo 1311:319:\u6258\u9a6c
>> "%MAP%" echo 1312:365:\u8f9b\u7131
>> "%MAP%" echo 1313:395:\u590f\u6c83\u857e
>> "%MAP%" echo 1314:454:\u963f\u857e\u5947\u8bfa
>> "%MAP%" echo 1315:478:\u739b\u8587\u5361
>> "%MAP%" echo 1316:534:\u5609\u660e
>> "%MAP%" echo 1317:608:\u675c\u6797
>> "%MAP%" echo 1401:26:\u83f2\u8c22\u5c14
>> "%MAP%" echo 1402:27:\u96f7\u6cfd
>> "%MAP%" echo 1403:28:\u523b\u6674
>> "%MAP%" echo 1404:29:\u8d5b\u8bfa
>> "%MAP%" echo 1405:30:\u5317\u6597
>> "%MAP%" echo 1406:31:\u4e5d\u6761\u88df\u7f57
>> "%MAP%" echo 1407:32:\u96f7\u7535\u5c06\u519b
>> "%MAP%" echo 1408:33:\u516b\u91cd\u795e\u5b50
>> "%MAP%" echo 1409:34:\u4e3d\u838e
>> "%MAP%" echo 1410:35:\u591a\u8389
>> "%MAP%" echo 1411:348:\u4e45\u5c90\u5fcd
>> "%MAP%" echo 1412:445:\u514b\u6d1b\u7433\u5fb7
>> "%MAP%" echo 1413:469:\u8d5b\u7d22\u65af
>> "%MAP%" echo 1414:506:\u4f0a\u5b89\u73ca
>> "%MAP%" echo 1415:521:\u74e6\u96f7\u838e
>> "%MAP%" echo 1416:545:\u6b27\u6d1b\u4f26
>> "%MAP%" echo 1417:556:\u4f0a\u6d85\u8299
>> "%MAP%" echo 1418:584:\u83f2\u6797\u65af
>> "%MAP%" echo 1501:36:\u7802\u7cd6
>> "%MAP%" echo 1502:37:\u7434
>> "%MAP%" echo 1503:38:\u6e29\u8fea
>> "%MAP%" echo 1504:39:\u9b48
>> "%MAP%" echo 1505:40:\u67ab\u539f\u4e07\u53f6
>> "%MAP%" echo 1506:41:\u6d41\u6d6a\u8005
>> "%MAP%" echo 1507:320:\u65e9\u67da
>> "%MAP%" echo 1508:282:\u7433\u59ae\u7279
>> "%MAP%" echo 1509:349:\u73d0\u9732\u73ca
>> "%MAP%" echo 1510:408:\u95f2\u4e91
>> "%MAP%" echo 1511:479:\u6070\u65af\u5361
>> "%MAP%" echo 1512:492:\u84dd\u781a
>> "%MAP%" echo 1513:493:\u9e7f\u91ce\u9662\u5e73\u85cf
>> "%MAP%" echo 1514:507:\u68a6\u89c1\u6708\u745e\u5e0c
>> "%MAP%" echo 1515:522:\u4f0a\u6cd5
>> "%MAP%" echo 1516:609:\u96c5\u73c2\u8fbe
>> "%MAP%" echo 1517:630:\u6cd5\u5c14\u4f3d
>> "%MAP%" echo 1601:42:\u51dd\u5149
>> "%MAP%" echo 1602:43:\u8bfa\u827e\u5c14
>> "%MAP%" echo 1603:44:\u949f\u79bb
>> "%MAP%" echo 1604:45:\u963f\u8d1d\u591a
>> "%MAP%" echo 1605:46:\u8352\u6cf7\u4e00\u6597
>> "%MAP%" echo 1606:283:\u4e94\u90ce
>> "%MAP%" echo 1607:366:\u4e91\u5807
>> "%MAP%" echo 1608:396:\u5a1c\u7ef4\u5a05
>> "%MAP%" echo 1609:420:\u5343\u7ec7
>> "%MAP%" echo 1610:461:\u5361\u9f50\u5a1c
>> "%MAP%" echo 1611:470:\u5e0c\u8bfa\u5b81
>> "%MAP%" echo 1612:621:\u53f6\u6d1b\u4e9a
>> "%MAP%" echo 1701:47:\u67ef\u83b1
>> "%MAP%" echo 1702:48:\u63d0\u7eb3\u91cc
>> "%MAP%" echo 1703:49:\u7eb3\u897f\u59b2
>> "%MAP%" echo 1704:50:\u7476\u7476
>> "%MAP%" echo 1705:51:\u767d\u672f
>> "%MAP%" echo 1706:284:\u827e\u5c14\u6d77\u68ee
>> "%MAP%" echo 1707:336:\u7eee\u826f\u826f
>> "%MAP%" echo 1708:367:\u5361\u7ef4
>> "%MAP%" echo 1709:455:\u57fa\u5c3c\u5947
>> "%MAP%" echo 1710:462:\u827e\u6885\u8389\u57c3
>> "%MAP%" echo 1711:585:\u83c8\u4e4c\u739b
>> "%MAP%" echo 1712:596:\u5948\u8299\u5c14
>> "%MAP%" echo 2101:52:\u611a\u4eba\u4f17\u00b7\u51b0\u8424\u672f\u58eb
>> "%MAP%" echo 2102:277:\u300c\u5973\u58eb\u300d
>> "%MAP%" echo 2103:321:\u65e0\u76f8\u4e4b\u51b0
>> "%MAP%" echo 2104:397:\u611a\u4eba\u4f17\u00b7\u971c\u5f79\u4eba
>> "%MAP%" echo 2105:597:\u7075\u89c9\u9690\u4fee\u7684\u8ff7\u8005
>> "%MAP%" echo 2201:53:\u7eaf\u6c34\u7cbe\u7075\u00b7\u6d1b\u8482\u5a05
>> "%MAP%" echo 2202:54:\u611a\u4eba\u4f17\u00b7\u85cf\u955c\u4ed5\u5973
>> "%MAP%" echo 2203:350:\u6df1\u6e0a\u4f7f\u5f92\u00b7\u6fc0\u6d41
>> "%MAP%" echo 2204:368:\u541e\u661f\u4e4b\u9cb8
>> "%MAP%" echo 2205:409:\u4e18\u4e18\u6c34\u884c\u6e38\u4fa0
>> "%MAP%" echo 2206:523:\u6c34\u5f62\u5e7b\u4eba
>> "%MAP%" echo 2207:546:\u5723\u9ab8\u89d2\u9cc4
>> "%MAP%" echo 2208:610:\u65e0\u76f8\u4e4b\u6c34
>> "%MAP%" echo 2301:55:\u611a\u4eba\u4f17\u00b7\u706b\u4e4b\u503a\u52a1\u5904\u7406\u4eba
>> "%MAP%" echo 2302:56:\u6df1\u6e0a\u548f\u8005\u00b7\u6e0a\u706b
>> "%MAP%" echo 2303:285:\u9540\u91d1\u65c5\u56e2\u00b7\u70bd\u6c99\u53d9\u4e8b\u4eba
>> "%MAP%" echo 2304:351:\u94c1\u7532\u7194\u706b\u5e1d\u7687
>> "%MAP%" echo 2305:508:\u8680\u706d\u7684\u6e90\u7130\u4e4b\u4e3b
>> "%MAP%" echo 2306:557:\u91d1\u7130\u7ed2\u7ffc\u9f99\u66b4\u541b
>> "%MAP%" echo 2401:57:\u65e0\u76f8\u4e4b\u96f7
>> "%MAP%" echo 2402:286:\u96f7\u97f3\u6743\u73b0
>> "%MAP%" echo 2403:322:\u5343\u5e74\u73cd\u73e0\u9a8f\u9e9f
>> "%MAP%" echo 2404:337:\u611a\u4eba\u4f17\u00b7\u96f7\u8424\u672f\u58eb
>> "%MAP%" echo 2405:369:\u5723\u9ab8\u6bd2\u874e
>> "%MAP%" echo 2406:421:\u6df1\u6e0a\u548f\u8005\u00b7\u7d2b\u7535
>> "%MAP%" echo 2501:58:\u9b54\u5076\u5251\u9b3c
>> "%MAP%" echo 2502:287:\u7279\u74e6\u6797
>> "%MAP%" echo 2503:370:\u5723\u9ab8\u98de\u86c7
>> "%MAP%" echo 2504:598:\u9ed1\u86c7\u9a91\u58eb\u00b7\u65a9\u98ce\u4e4b\u5251
>> "%MAP%" echo 2601:59:\u4e18\u4e18\u5ca9\u76d4\u738b
>> "%MAP%" echo 2602:278:\u82e5\u9640\u9f99\u738b
>> "%MAP%" echo 2603:434:\u9ec4\u91d1\u738b\u517d
>> "%MAP%" echo 2604:535:\u9ed1\u86c7\u9a91\u58eb\u00b7\u6467\u5ca9\u4e4b\u94ba
>> "%MAP%" echo 2605:586:\u5b9e\u9a8c\u6027\u573a\u529b\u53d1\u751f\u88c5\u7f6e
>> "%MAP%" echo 2701:60:\u7fe0\u7fce\u6050\u8548
>> "%MAP%" echo 2702:371:\u963f\u4f69\u666e\u7684\u7eff\u6d32\u5b88\u671b\u8005
>> "%MAP%" echo 2703:422:\u9540\u91d1\u65c5\u56e2\u00b7\u53f6\u8f6e\u821e\u8005
>> "%MAP%" echo 2704:494:\u8d2a\u98df\u533f\u53f6\u9f99\u5c71\u738b
>> "%MAP%" echo 2705:572:\u5723\u9ab8\u7259\u517d
>> "%MAP%" echo 211011:61:\u552f\u6b64\u4e00\u5fc3
>> "%MAP%" echo 211021:62:\u732b\u722a\u51b0\u6447
>> "%MAP%" echo 211031:63:\u51b7\u8840\u4e4b\u5251
>> "%MAP%" echo 211041:64:\u5410\u7eb3\u771f\u5b9a
>> "%MAP%" echo 211051:65:\u5bd2\u5929\u5ba3\u547d\u795d\u8bcd
>> "%MAP%" echo 211061:66:\u6218\u6b32\u6d8c\u73b0
>> "%MAP%" echo 211071:67:\u5fd8\u7384
>> "%MAP%" echo 211081:68:\u8d77\u6b7b\u56de\u9ab8
>> "%MAP%" echo 211091:288:\u5f52\u8292\u643a\u4fe1
>> "%MAP%" echo 211101:338:\u4ee5\u6709\u8da3\u76f8\u5173\u4e3a\u8981\u4e49
>> "%MAP%" echo 211111:372:\u4e88\u884c\u6076\u8005\u4ee5\u60e9\u60e7
>> "%MAP%" echo 211121:410:\u68a6\u6653\u4e0e\u51b3\u610f\u4e4b\u523b
>> "%MAP%" echo 211131:435:\u4ee3\u884c\u88c1\u5224
>> "%MAP%" echo 211141:480:\u4e94\u91cd\u5929\u7684\u5bd2\u96e8
>> "%MAP%" echo 211151:536:\u8679\u5f69\u7f24\u7eb7\u7684\u751c\u70b9\u8336\u8bdd
>> "%MAP%" echo 211161:547:\u6e6e\u8fdc
>> "%MAP%" echo 211171:558:\u4f9d\u968f\u7684\u7b56\u63f4
>> "%MAP%" echo 212011:69:\u5149\u8f89\u7684\u5b63\u8282
>> "%MAP%" echo 212021:70:\u91cd\u5e18\u7559\u9999
>> "%MAP%" echo 212031:71:\u6c89\u6ca1\u7684\u9884\u8a00
>> "%MAP%" echo 212032:614:\u5929\u6b65\u771f\u539f
>> "%MAP%" echo 212041:72:\u6df1\u6e0a\u4e4b\u707e\u00b7\u51dd\u6c34\u76db\u653e
>> "%MAP%" echo 212051:73:\u5323\u4e2d\u7389\u6809
>> "%MAP%" echo 212061:74:\u955c\u534e\u98ce\u59ff
>> "%MAP%" echo 212071:75:\u884d\u6ea2\u7684\u6c50\u6f6e
>> "%MAP%" echo 212081:76:\u661f\u5929\u7684\u82b1\u96e8
>> "%MAP%" echo 212091:289:\u731c\u5148\u6709\u65b9
>> "%MAP%" echo 212101:339:\u53e4\u6d77\u5b51\u9057\u7684\u6743\u67c4
>> "%MAP%" echo 212111:373:\u300c\u8bf8\u541b\u542c\u6211\u9882\uff0c\u5171\u4e3e\u7231\u4e4b\u676f\uff01\u300d
>> "%MAP%" echo 212131:436:\u5e94\u6709\u9002\u5f53\u7684\u4f11\u61a9
>> "%MAP%" echo 212141:446:\u591c\u57df\u8d50\u793c\u00b7\u6ce2\u6d9b\u9876\u5e95
>> "%MAP%" echo 212151:573:\u613f\u4e00\u5207\u6b22\u7766\u966a\u4f34\u4f60
>> "%MAP%" echo 212161:574:\u5929\u624d\u4e4b\u4e3a\u6784\u9020\u4e4b\u8d23\u4efb
>> "%MAP%" echo 212171:622:\u904d\u7167\u82b1\u6d77\uff0c\u9690\u5165\u7fa4\u5c71
>> "%MAP%" echo 213011:77:\u6d41\u706b\u7126\u707c
>> "%MAP%" echo 213021:78:\u4ea4\u53c9\u706b\u529b
>> "%MAP%" echo 213031:79:\u5192\u9669\u61a7\u61ac
>> "%MAP%" echo 213041:80:\u4e00\u89e6\u5373\u53d1
>> "%MAP%" echo 213051:81:\u957f\u91ce\u539f\u9f99\u52bf\u6d41\u661f\u7fa4
>> "%MAP%" echo 213061:82:\u7830\u7830\u793c\u7269
>> "%MAP%" echo 213062:615:\u706b\u82b1\u9b54\u6cd5
>> "%MAP%" echo 213071:83:\u8840\u4e4b\u7076\u706b
>> "%MAP%" echo 213081:84:\u6700\u7ec8\u89e3\u91ca\u6743
>> "%MAP%" echo 213091:85:\u5d07\u8bda\u4e4b\u771f
>> "%MAP%" echo 213101:290:\u5b8c\u573a\u559d\u5f69
>> "%MAP%" echo 213111:323:\u50da\u4f50\u7684\u624d\u5de7
>> "%MAP%" echo 213121:374:\u5730\u72f1\u91cc\u6447\u6446
>> "%MAP%" echo 213131:398:\u5c16\u5175\u534f\u540c\u6218\u6cd5
>> "%MAP%" echo 213141:456:\u6240\u6709\u7684\u4ec7\u4e0e\u503a\u7686\u7531\u6211\u507f\u2026
>> "%MAP%" echo 213151:481:\u300c\u4eba\u4e4b\u540d\u300d\u89e3\u653e
>> "%MAP%" echo 213161:537:\u901a\u660e\u5e87\u4f51
>> "%MAP%" echo 213171:611:\u7ea2\u571f\u4e4b\u9006
>> "%MAP%" echo 213172:631:\u5347\u534e\u8d5e\u6b4c
>> "%MAP%" echo 214011:86:\u566c\u661f\u9b54\u9e26
>> "%MAP%" echo 214012:616:\u5bb5\u4e16\u5e7b\u594f
>> "%MAP%" echo 214021:87:\u89c9\u9192
>> "%MAP%" echo 214022:623:\u82cd\u96f7\u5954\u6d8c
>> "%MAP%" echo 214031:88:\u62b5\u5929\u96f7\u7f5a
>> "%MAP%" echo 214041:89:\u843d\u7fbd\u7684\u88c1\u62e9
>> "%MAP%" echo 214051:90:\u9739\u96f3\u8fde\u9704
>> "%MAP%" echo 214061:91:\u6211\u754c
>> "%MAP%" echo 214071:92:\u4e07\u5343\u7684\u613f\u671b
>> "%MAP%" echo 214081:93:\u795e\u7bf1\u4e4b\u5fa1\u836b
>> "%MAP%" echo 214091:94:\u8109\u51b2\u7684\u9b54\u5973
>> "%MAP%" echo 214101:95:\u914c\u76c8\u5242\u865a
>> "%MAP%" echo 214111:362:\u5272\u820d\u8f6f\u5f31\u4e4b\u5fc3
>> "%MAP%" echo 214121:447:\u7834\u591c\u7684\u660e\u7130
>> "%MAP%" echo 214131:471:\u5de1\u65e5\u5854\u95e8\u4e66
>> "%MAP%" echo 214141:509:\u300c\u6c83\u9646\u4e4b\u90a6\u300d\u7684\u8bad\u6559
>> "%MAP%" echo 214151:524:\u6b63\u4e49\u82f1\u96c4\u7684\u51ef\u65cb
>> "%MAP%" echo 214161:548:\u6797\u96fe\u95f4\u7684\u884c\u8ff9
>> "%MAP%" echo 214171:559:\u5faa\u73af\u6574\u6d41\u5f15\u64ce
>> "%MAP%" echo 214181:587:\u62e8\u5f00\u96ea\u7ff3\u4e4b\u5e55
>> "%MAP%" echo 215011:96:\u6df7\u5143\u71b5\u589e\u8bba
>> "%MAP%" echo 215012:624:\u4e03\u5faa\u4e4b\u7406
>> "%MAP%" echo 215021:97:\u84b2\u516c\u82f1\u7684\u56fd\u571f
>> "%MAP%" echo 215031:98:\u7eea\u98ce\u4e4b\u62e5
>> "%MAP%" echo 215032:617:\u9882\u65f6\u98ce\u82e5
>> "%MAP%" echo 215041:99:\u964d\u9b54\u00b7\u62a4\u6cd5\u591c\u53c9
>> "%MAP%" echo 215051:100:\u98ce\u7269\u4e4b\u8bd7\u548f
>> "%MAP%" echo 215061:101:\u68a6\u8ff9\u4e00\u98ce
>> "%MAP%" echo 215071:324:\u5077\u61d2\u7684\u65b0\u65b9\u6cd5
>> "%MAP%" echo 215081:291:\u5982\u5f71\u6d41\u9732\u7684\u51b7\u5203
>> "%MAP%" echo 215091:352:\u5999\u9053\u5408\u771f
>> "%MAP%" echo 215101:411:\u77e5\u662f\u7559\u4e91\u50ca
>> "%MAP%" echo 215111:482:\u5b50\u5f39\u7684\u620f\u6cd5
>> "%MAP%" echo 215121:495:\u821e\u8882\u7fe9\u516e\u626c\u7389\u9713
>> "%MAP%" echo 215131:496:\u5947\u60f3\u5929\u5f00\u6355\u7269\u5e10
>> "%MAP%" echo 215141:510:\u7f20\u5fc6\u541b\u5f71\u68a6\u76f8\u89c1
>> "%MAP%" echo 215151:525:\u6e29\u6577\u6218\u672f\u5305\u624e
>> "%MAP%" echo 215161:612:\u6697\u5df7\u7684\u9ee0\u6167
>> "%MAP%" echo 215171:632:\u300c\u56e0\u4e3a\u65e0\u4eba\u80fd\u593a\u53bb\u6211\u4eec\u6b4c\u5531\u7684\u81ea\u7531\u300d
>> "%MAP%" echo 215172:633:\u91cd\u5149\u4e34\u6668
>> "%MAP%" echo 216011:102:\u50a8\u4e4b\u5343\u65e5\uff0c\u7528\u4e4b\u4e00\u523b
>> "%MAP%" echo 216021:103:\u652f\u63f4\u5c31\u4ea4\u7ed9\u6211\u5427
>> "%MAP%" echo 216031:104:\u708a\u91d1\u9994\u7389
>> "%MAP%" echo 216041:105:\u795e\u6027\u4e4b\u9668
>> "%MAP%" echo 216042:625:\u767d\u8292\u4e4b\u4e66
>> "%MAP%" echo 216051:106:\u8352\u6cf7\u7b2c\u4e00
>> "%MAP%" echo 216061:292:\u72ac\u5954\u00b7\u75be\u5982\u98ce
>> "%MAP%" echo 216071:375:\u5e84\u8c10\u5e76\u4e3e
>> "%MAP%" echo 216081:399:\u4e0d\u660e\u6d41\u901a\u6e20\u9053
>> "%MAP%" echo 216091:423:\u843d\u67d3\u4e94\u8272
>> "%MAP%" echo 216101:463:\u591c\u57df\u8d50\u793c\u00b7\u56e2\u7ed3\u7089\u5fc3
>> "%MAP%" echo 216111:472:\u4e1b\u5c71\u953b\u706b\u9a70\u884c
>> "%MAP%" echo 216121:626:\u566c\u679d\u4e4b\u9e8b
>> "%MAP%" echo 217011:107:\u98de\u53f6\u8ff4\u659c
>> "%MAP%" echo 217021:108:\u773c\u8bc6\u6b8a\u660e
>> "%MAP%" echo 217031:109:\u5fc3\u8bc6\u8574\u85cf\u4e4b\u79cd
>> "%MAP%" echo 217041:110:\u6148\u60e0\u4ec1\u5fc3
>> "%MAP%" echo 217051:111:\u5728\u5730\u4e3a\u5316
>> "%MAP%" echo 217061:293:\u6b63\u7406
>> "%MAP%" echo 217071:340:\u6cbf\u9014\u767e\u666f\u4f1a\u5fc3
>> "%MAP%" echo 217081:376:\u9884\u7b97\u5e08\u7684\u6280\u827a
>> "%MAP%" echo 217091:457:\u591c\u57df\u8d50\u793c\u00b7\u7d22\u62a5\u7686\u507f
>> "%MAP%" echo 217101:464:\u8309\u6d01\u9999\u8ff9
>> "%MAP%" echo 217111:588:\u300c\u5507\u554a\uff0c\u4e3a\u6211\u7eba\u51fa\u6b4c\u4e0e\u541f\u54e6\u300d
>> "%MAP%" echo 217121:599:\u51b3\u80dc\u4e8e\u9006\u8f6c\u4e4b\u65f6
>> "%MAP%" echo 221011:112:\u51b0\u8424\u5bd2\u5149
>> "%MAP%" echo 221021:294:\u82e6\u75db\u5949\u8fd8
>> "%MAP%" echo 221031:325:\u4e25\u971c\u68f1\u6676
>> "%MAP%" echo 221041:400:\u51b0\u96c5\u523a\u5251
>> "%MAP%" echo 221051:600:\u6d41\u53d8\u7684\u7ed8\u5f62
>> "%MAP%" echo 222011:113:\u767e\u5ddd\u5954\u6d41
>> "%MAP%" echo 222021:114:\u955c\u9522\u4e4b\u7b3c
>> "%MAP%" echo 222031:353:\u6697\u6d41\u6d8c\u52a8
>> "%MAP%" echo 222041:377:\u65e0\u5149\u9cb8\u566c
>> "%MAP%" echo 222051:412:\u8f7b\u76c8\u6c34\u6cab
>> "%MAP%" echo 222061:526:\u6c47\u6d41
>> "%MAP%" echo 222071:549:\u4ea1\u6c34\u6ea2\u6d41
>> "%MAP%" echo 222081:613:\u8be1\u8c32\u6076\u6d6a
>> "%MAP%" echo 223011:115:\u6089\u6570\u8ba8\u56de
>> "%MAP%" echo 223021:116:\u70ec\u706b\u91cd\u71c3
>> "%MAP%" echo 223031:295:\u9b54\u874e\u70c8\u7978
>> "%MAP%" echo 223041:354:\u7194\u706b\u94c1\u7532
>> "%MAP%" echo 223051:511:\u7f54\u6781\u76db\u6012
>> "%MAP%" echo 223061:560:\u300c\u7130\u4e3b\u4e4b\u795d\u300d
>> "%MAP%" echo 224011:117:\u6c72\u80fd\u68f1\u6676
>> "%MAP%" echo 224021:296:\u60b2\u53f7\u56de\u5531
>> "%MAP%" echo 224031:326:\u660e\u73e0\u56fa\u5316
>> "%MAP%" echo 224041:341:\u96f7\u8424\u6d6e\u95ea
>> "%MAP%" echo 224051:378:\u4ea1\u96f7\u51dd\u84c4
>> "%MAP%" echo 224061:424:\u4fb5\u96f7\u91cd\u95ea
>> "%MAP%" echo 225011:118:\u673a\u5de7\u795e\u901a
>> "%MAP%" echo 225021:297:\u6bc1\u88c2\u98ce\u6da1
>> "%MAP%" echo 225031:379:\u4ea1\u98ce\u5578\u5377
>> "%MAP%" echo 225041:601:\u300c\u66fe\u5982\u5b64\u98ce\u963b\u9694\u9ed1\u707e\u8513\u5ef6\u2026\u300d
>> "%MAP%" echo 226011:119:\u91cd\u94f8\uff1a\u5ca9\u76d4
>> "%MAP%" echo 226022:298:\u6666\u6714\u5343\u5f15
>> "%MAP%" echo 226031:437:\u5f02\u517d\u4fb5\u8680
>> "%MAP%" echo 226041:538:\u300c\u66fe\u5982\u78d0\u77f3\u62b5\u6321\u9ed1\u6c34\u5954\u6d41\u2026\u300d
>> "%MAP%" echo 226051:589:\u91cd\u529b\u573a\u57df
>> "%MAP%" echo 227011:120:\u5b62\u5b50\u589e\u6b96
>> "%MAP%" echo 227021:380:\u4e07\u5343\u5b50\u55e3
>> "%MAP%" echo 227031:425:\u7075\u86c7\u65cb\u5636
>> "%MAP%" echo 227041:497:\u9955\u566c\u5c3d\u541e
>> "%MAP%" echo 227051:575:\u4ea1\u8349\u853d\u65e5
>> "%MAP%" echo 311101:121:\u9b54\u5bfc\u7eea\u8bba
>> "%MAP%" echo 311102:122:\u796d\u793c\u6b8b\u7ae0
>> "%MAP%" echo 311103:123:\u5929\u7a7a\u4e4b\u5377
>> "%MAP%" echo 311104:124:\u5343\u591c\u6d6e\u68a6
>> "%MAP%" echo 311105:125:\u76c8\u6ee1\u4e4b\u5b9e
>> "%MAP%" echo 311106:299:\u56db\u98ce\u539f\u5178
>> "%MAP%" echo 311107:300:\u56fe\u83b1\u675c\u62c9\u7684\u56de\u5fc6
>> "%MAP%" echo 311108:342:\u4e07\u4e16\u6d41\u6d8c\u5927\u5178
>> "%MAP%" echo 311109:381:\u91d1\u6d41\u76d1\u7763
>> "%MAP%" echo 311110:438:\u7eaf\u6c34\u6d41\u534e
>> "%MAP%" echo 311111:527:\u4e0d\u706d\u6708\u534e
>> "%MAP%" echo 311112:550:\u796d\u661f\u8005\u4e4b\u671b
>> "%MAP%" echo 311201:126:\u9e26\u7fbd\u5f13
>> "%MAP%" echo 311202:127:\u796d\u793c\u5f13
>> "%MAP%" echo 311203:128:\u5929\u7a7a\u4e4b\u7ffc
>> "%MAP%" echo 311204:129:\u963f\u83ab\u65af\u4e4b\u5f13
>> "%MAP%" echo 311205:130:\u7ec8\u672b\u55df\u53f9\u4e4b\u8bd7
>> "%MAP%" echo 311206:131:\u738b\u4e0b\u8fd1\u4f8d
>> "%MAP%" echo 311207:382:\u7aed\u6cfd
>> "%MAP%" echo 311208:520:\u82e5\u6c34
>> "%MAP%" echo 311209:576:\u7f57\u7f51\u52fe\u9488
>> "%MAP%" echo 311301:132:\u767d\u94c1\u5927\u5251
>> "%MAP%" echo 311302:133:\u796d\u793c\u5927\u5251
>> "%MAP%" echo 311303:134:\u72fc\u7684\u672b\u8def
>> "%MAP%" echo 311304:135:\u5929\u7a7a\u4e4b\u50b2
>> "%MAP%" echo 311305:136:\u949f\u5251
>> "%MAP%" echo 311306:301:\u82c7\u6d77\u4fe1\u6807
>> "%MAP%" echo 311307:383:\u68ee\u6797\u738b\u5668
>> "%MAP%" echo 311308:401:\u300c\u7a76\u6781\u9738\u738b\u8d85\u7ea7\u9b54\u5251\u300d
>> "%MAP%" echo 311309:426:\u4fbf\u643a\u52a8\u529b\u952f
>> "%MAP%" echo 311310:551:\u62fe\u6167\u94f8\u7194
>> "%MAP%" echo 311401:137:\u767d\u7f28\u67aa
>> "%MAP%" echo 311402:138:\u5343\u5ca9\u957f\u67aa
>> "%MAP%" echo 311403:139:\u5929\u7a7a\u4e4b\u810a
>> "%MAP%" echo 311404:140:\u8d2f\u8679\u4e4b\u69ca
>> "%MAP%" echo 311405:141:\u8599\u8349\u4e4b\u7a3b\u5149
>> "%MAP%" echo 311406:142:\u8d2f\u6708\u77e2
>> "%MAP%" echo 311407:302:\u548c\u749e\u9e22
>> "%MAP%" echo 311408:355:\u516c\u4e49\u7684\u916c\u62a5
>> "%MAP%" echo 311409:402:\u52d8\u63a2\u94bb\u673a
>> "%MAP%" echo 311501:143:\u65c5\u884c\u5251
>> "%MAP%" echo 311502:144:\u796d\u793c\u5251
>> "%MAP%" echo 311503:145:\u98ce\u9e70\u5251
>> "%MAP%" echo 311504:146:\u5929\u7a7a\u4e4b\u5203
>> "%MAP%" echo 311505:147:\u897f\u98ce\u5251
>> "%MAP%" echo 311506:303:\u88c1\u53f6\u8403\u5149
>> "%MAP%" echo 311507:327:\u539f\u6728\u5200
>> "%MAP%" echo 311508:384:\u9759\u6c34\u6d41\u6d8c\u4e4b\u8f89
>> "%MAP%" echo 311509:483:\u8239\u575e\u957f\u5251
>> "%MAP%" echo 312001:148:\u5192\u9669\u5bb6\u5934\u5e26
>> "%MAP%" echo 312002:149:\u5e78\u8fd0\u513f\u94f6\u51a0
>> "%MAP%" echo 312003:150:\u6e38\u533b\u7684\u65b9\u5dfe
>> "%MAP%" echo 312004:151:\u8d4c\u5f92\u7684\u8033\u73af
>> "%MAP%" echo 312005:152:\u6559\u5b98\u7684\u5e3d\u5b50
>> "%MAP%" echo 312006:153:\u6d41\u653e\u8005\u5934\u51a0
>> "%MAP%" echo 312007:154:\u534e\u9970\u4e4b\u515c
>> "%MAP%" echo 312008:155:\u7edd\u7f18\u4e4b\u65d7\u5370
>> "%MAP%" echo 312009:156:\u5c06\u5e05\u515c\u936a
>> "%MAP%" echo 312010:157:\u5343\u5ca9\u7262\u56fa
>> "%MAP%" echo 312011:158:\u867a\u96f7\u4e4b\u59ff
>> "%MAP%" echo 312012:159:\u8fb0\u7802\u5f80\u751f\u5f55
>> "%MAP%" echo 312013:160:\u65e0\u5e38\u4e4b\u9762
>> "%MAP%" echo 312014:161:\u8ffd\u5fc6\u4e4b\u6ce8\u8fde
>> "%MAP%" echo 312015:162:\u6d77\u7947\u4e4b\u51a0
>> "%MAP%" echo 312016:163:\u6d77\u67d3\u7817\u78f2
>> "%MAP%" echo 312017:164:\u6c99\u738b\u7684\u6295\u5f71
>> "%MAP%" echo 312018:304:\u9970\u91d1\u4e4b\u68a6
>> "%MAP%" echo 312019:305:\u6d6e\u6eaf\u4e4b\u73cf
>> "%MAP%" echo 312020:306:\u6765\u6b46\u4f59\u54cd
>> "%MAP%" echo 312021:307:\u7075\u5149\u660e\u70c1\u4e4b\u5fc3
>> "%MAP%" echo 312022:308:\u82b1\u6d77\u7518\u9732\u4e4b\u5149
>> "%MAP%" echo 312023:328:\u8001\u5175\u7684\u5bb9\u989c
>> "%MAP%" echo 312024:385:\u9010\u5f71\u730e\u4eba
>> "%MAP%" echo 312025:343:\u9ec4\u91d1\u5267\u56e2\u7684\u5956\u8d4f
>> "%MAP%" echo 312026:386:\u9ec4\u91d1\u5267\u56e2
>> "%MAP%" echo 312027:356:\u7d2b\u6676\u7684\u82b1\u51a0
>> "%MAP%" echo 312028:387:\u4e50\u56ed\u9057\u843d\u4e4b\u82b1
>> "%MAP%" echo 312029:403:\u89d2\u6597\u58eb\u7684\u51ef\u65cb
>> "%MAP%" echo 312030:427:\u6307\u6325\u7684\u793c\u5e3d
>> "%MAP%" echo 312031:439:\u5c11\u5973\u6613\u901d\u7684\u82b3\u989c
>> "%MAP%" echo 312032:448:\u9b54\u6218\u58eb\u7684\u7fbd\u9762
>> "%MAP%" echo 312033:484:\u8bf8\u5723\u7684\u793c\u51a0
>> "%MAP%" echo 312034:485:\u70ec\u57ce\u52c7\u8005\u7ed8\u5377
>> "%MAP%" echo 312035:498:\u5931\u5195\u7684\u5b9d\u51a0
>> "%MAP%" echo 312036:499:\u5f02\u60f3\u96f6\u843d\u7684\u5706\u821e
>> "%MAP%" echo 312037:512:\u5b97\u5ba4\u9762\u5177
>> "%MAP%" echo 312038:513:\u672a\u7adf\u7684\u9050\u601d
>> "%MAP%" echo 312039:514:\u8c10\u5f8b\u5f02\u60f3\u65ad\u7ae0
>> "%MAP%" echo 312040:528:\u6076\u9f99\u7684\u5355\u7247\u955c
>> "%MAP%" echo 312041:529:\u6614\u65e5\u5b97\u5ba4\u4e4b\u4eea
>> "%MAP%" echo 312043:539:\u6c34\u4ed9\u4e4b\u68a6
>> "%MAP%" echo 312044:552:\u88ab\u6d78\u67d3\u7684\u7f28\u76d4
>> "%MAP%" echo 312045:590:\u89d2\u6597\u58eb\u7684\u7ec8\u5e55\u793c
>> "%MAP%" echo 312046:627:\u6614\u65f6\u6d6e\u60f3\u4e4b\u601d
>> "%MAP%" echo 312047:634:\u6614\u65f6\u4e4b\u6b4c
>> "%MAP%" echo 312101:165:\u7834\u51b0\u8e0f\u96ea\u7684\u56de\u97f3
>> "%MAP%" echo 312102:166:\u51b0\u98ce\u8ff7\u9014\u7684\u52c7\u58eb
>> "%MAP%" echo 312201:167:\u9152\u6e0d\u8239\u5e3d
>> "%MAP%" echo 312202:168:\u6c89\u6ca6\u4e4b\u5fc3
>> "%MAP%" echo 312301:169:\u7126\u707c\u7684\u9b54\u5973\u5e3d
>> "%MAP%" echo 312302:170:\u70bd\u70c8\u7684\u708e\u4e4b\u9b54\u5973
>> "%MAP%" echo 312401:171:\u5524\u96f7\u7684\u5934\u51a0
>> "%MAP%" echo 312402:172:\u5982\u96f7\u7684\u76db\u6012
>> "%MAP%" echo 312501:173:\u7fe0\u7eff\u7684\u730e\u4eba\u4e4b\u51a0
>> "%MAP%" echo 312502:174:\u7fe0\u7eff\u4e4b\u5f71
>> "%MAP%" echo 312601:175:\u4e0d\u52a8\u7384\u77f3\u4e4b\u76f8
>> "%MAP%" echo 312602:176:\u60a0\u53e4\u7684\u78d0\u5ca9
>> "%MAP%" echo 312701:177:\u6708\u6842\u7684\u5b9d\u51a0
>> "%MAP%" echo 312702:178:\u6df1\u6797\u7684\u8bb0\u5fc6
>> "%MAP%" echo 313001:413:\u5f02\u8272\u730e\u5200\u9cd0
>> "%MAP%" echo 313002:414:\u533f\u53f6\u9f99
>> "%MAP%" echo 313003:415:\u9ccd\u6e38\u9f99
>> "%MAP%" echo 313004:428:\u5d74\u950b\u9f99
>> "%MAP%" echo 313005:440:\u669d\u89c6\u9f99
>> "%MAP%" echo 313006:449:\u7ed2\u7ffc\u9f99
>> "%MAP%" echo 313007:465:\u6d6a\u8239
>> "%MAP%" echo 313008:473:\u7a81\u89d2\u9f99
>> "%MAP%" echo 313009:486:\u5440\uff01\u5440\uff01
>> "%MAP%" echo 313010:577:\u81a8\u81a8\u517d
>> "%MAP%" echo 321001:179:\u7483\u6708\u6e2f\u53e3
>> "%MAP%" echo 321002:180:\u9a91\u58eb\u56e2\u56fe\u4e66\u9986
>> "%MAP%" echo 321003:181:\u7fa4\u7389\u9601
>> "%MAP%" echo 321004:182:\u6668\u66e6\u9152\u5e84
>> "%MAP%" echo 321005:183:\u671b\u8212\u5ba2\u6808
>> "%MAP%" echo 321006:184:\u897f\u98ce\u5927\u6559\u5802
>> "%MAP%" echo 321007:185:\u5929\u5b88\u9601
>> "%MAP%" echo 321008:186:\u9e23\u795e\u5927\u793e
>> "%MAP%" echo 321009:187:\u73ca\u745a\u5bab
>> "%MAP%" echo 321010:188:\u987b\u5f25\u57ce
>> "%MAP%" echo 321011:189:\u6853\u90a3\u5170\u90a3
>> "%MAP%" echo 321012:190:\u9547\u5b88\u4e4b\u68ee
>> "%MAP%" echo 321013:191:\u9ec4\u91d1\u5c4b
>> "%MAP%" echo 321014:192:\u5316\u57ce\u90ed
>> "%MAP%" echo 321015:193:\u98ce\u9f99\u5e9f\u589f
>> "%MAP%" echo 321016:309:\u6e56\u4e2d\u5782\u67f3
>> "%MAP%" echo 321017:310:\u6b27\u5e87\u514b\u83b1\u6b4c\u5267\u9662
>> "%MAP%" echo 321018:344:\u6885\u6d1b\u5f7c\u5f97\u5821
>> "%MAP%" echo 321019:357:\u6e05\u7c41\u5c9b
>> "%MAP%" echo 321020:388:\u8d64\u738b\u9675
>> "%MAP%" echo 321021:389:\u4e2d\u592e\u5b9e\u9a8c\u5ba4\u9057\u5740
>> "%MAP%" echo 321022:416:\u5723\u706b\u7ade\u6280\u573a
>> "%MAP%" echo 321023:429:\u7279\u4f69\u5229\u821e\u53f0
>> "%MAP%" echo 321024:441:\u300c\u60ac\u6728\u4eba\u300d
>> "%MAP%" echo 321025:450:\u300c\u6d41\u6cc9\u4e4b\u4f17\u300d
>> "%MAP%" echo 321026:458:\u300c\u82b1\u7fbd\u4f1a\u300d
>> "%MAP%" echo 321027:466:\u300c\u70df\u8c1c\u4e3b\u300d
>> "%MAP%" echo 321028:474:\u300c\u6c83\u9646\u4e4b\u90a6\u300d
>> "%MAP%" echo 321029:500:\u58a8\u8272\u9152\u9986
>> "%MAP%" echo 321030:501:\u661f\u8f68\u738b\u57ce
>> "%MAP%" echo 321031:530:\u5192\u9669\u5bb6\u534f\u4f1a
>> "%MAP%" echo 321035:561:\u94f6\u6708\u4e4b\u5ead
>> "%MAP%" echo 321036:562:\u6c50\u5370\u77f3
>> "%MAP%" echo 321037:563:\u971c\u6708\u4e4b\u574a
>> "%MAP%" echo 321038:564:\u90a3\u590f\u9547
>> "%MAP%" echo 321039:565:\u6708\u77e9\u529b\u8bd5\u9a8c\u8bbe\u8ba1\u5c40
>> "%MAP%" echo 321041:602:\u5669\u68a6\u7684\u9884\u5146
>> "%MAP%" echo 322001:194:\u6d3e\u8499
>> "%MAP%" echo 322002:195:\u51ef\u745f\u7433
>> "%MAP%" echo 322003:196:\u8482\u739b\u4e4c\u65af
>> "%MAP%" echo 322004:197:\u74e6\u683c\u7eb3
>> "%MAP%" echo 322005:198:\u536f\u5e08\u5085
>> "%MAP%" echo 322006:199:\u963f\u5706
>> "%MAP%" echo 322007:200:\u63d0\u7c73
>> "%MAP%" echo 322008:201:\u7acb\u672c
>> "%MAP%" echo 322009:202:\u5e38\u4e5d\u7237
>> "%MAP%" echo 322010:203:\u827e\u7433
>> "%MAP%" echo 322011:204:\u7530\u94c1\u5634
>> "%MAP%" echo 322012:205:\u5218\u82cf
>> "%MAP%" echo 322013:206:\u82b1\u6563\u91cc
>> "%MAP%" echo 322014:207:\u9cb8\u4e95\u5c0f\u5f1f
>> "%MAP%" echo 322015:208:\u65ed\u4e1c
>> "%MAP%" echo 322016:209:\u8fea\u5a1c\u6cfd\u9edb
>> "%MAP%" echo 322017:210:\u62c9\u5a1c
>> "%MAP%" echo 322018:211:\u8001\u7ae0
>> "%MAP%" echo 322019:212:\u585e\u5854\u857e
>> "%MAP%" echo 322020:213:\u5f25\u751f\u4e03\u6708
>> "%MAP%" echo 322021:311:\u739b\u6885\u8d6b
>> "%MAP%" echo 322022:329:\u5a55\u5fb7
>> "%MAP%" echo 322023:330:\u897f\u5c14\u5f17\u548c\u8fc8\u52d2\u65af
>> "%MAP%" echo 322024:358:\u592a\u90ce\u4e38
>> "%MAP%" echo 322025:359:\u767d\u624b\u5957\u548c\u6e14\u592b
>> "%MAP%" echo 322026:390:\u4e9a\u745f\u5148\u751f
>> "%MAP%" echo 322027:404:\u745f\u7433
>> "%MAP%" echo 322028:417:\u963f\u4f3d\u5a05
>> "%MAP%" echo 322029:502:\u68ee\u6797\u7684\u795d\u798f
>> "%MAP%" echo 322030:503:\u9884\u8a00\u5973\u795e\u7684\u793c\u7269
>> "%MAP%" echo 322031:540:\u897f\u6469\u5c14
>> "%MAP%" echo 322032:553:\u73bb\u5a1c\u4e0e\u300c\u7eff\u677e\u77f3\u300d
>> "%MAP%" echo 322033:578:\u4e50\u5e73\u6ce2\u7433
>> "%MAP%" echo 322034:591:\u6d85\u6735\u5947\u5361
>> "%MAP%" echo 322035:635:\u5f69\u7279\u7433\u5fb7
>> "%MAP%" echo 323001:214:\u53c2\u91cf\u8d28\u53d8\u4eea
>> "%MAP%" echo 323002:215:\u4fbf\u643a\u8425\u517b\u888b
>> "%MAP%" echo 323003:216:\u7ea2\u7fbd\u56e2\u6247
>> "%MAP%" echo 323004:217:\u5bfb\u5b9d\u4ed9\u7075
>> "%MAP%" echo 323005:312:\u5316\u79cd\u5323
>> "%MAP%" echo 323006:313:\u7559\u5ff5\u955c
>> "%MAP%" echo 323007:345:\u6d41\u660e\u77f3\u89e6\u5a92
>> "%MAP%" echo 323008:391:\u82e6\u820d\u6853
>> "%MAP%" echo 330001:218:\u65e7\u65f6\u5ead\u56ed
>> "%MAP%" echo 330002:219:\u78d0\u5ca9\u76df\u5951
>> "%MAP%" echo 330003:220:\u6109\u821e\u6b22\u6e38
>> "%MAP%" echo 330004:221:\u81ea\u7531\u7684\u65b0\u98ce
>> "%MAP%" echo 330005:222:\u4e07\u5bb6\u7076\u706b
>> "%MAP%" echo 330006:314:\u88c1\u5b9a\u4e4b\u65f6
>> "%MAP%" echo 330007:346:\u6297\u4e89\u4e4b\u65e5\u00b7\u788e\u68a6\u4e4b\u65f6
>> "%MAP%" echo 330008:392:\u65e7\u65e5\u93d6\u6218
>> "%MAP%" echo 330009:419:\u8d66\u514d\u5ba3\u544a
>> "%MAP%" echo 330010:451:\u5f52\u706b\u5723\u591c\u5de1\u793c
>> "%MAP%" echo 330011:487:\u4e3a\u300c\u6b7b\u300d\u800c\u6218
>> "%MAP%" echo 330012:541:\u300c\u6c99\u4e2d\u9057\u4e8b\u300d
>> "%MAP%" echo 330013:594:\u53e6\u4e00\u4fa7\u7684\u971c\u6708
>> "%MAP%" echo 330014:629:\u4e09\u6708\u91cd\u4e34
>> "%MAP%" echo 330015:637:\u6d6e\u69c3\u4e4b\u6b4c
>> "%MAP%" echo 331004:566:\u5143\u7d20\u5e7b\u53d8\uff1a\u8d85\u5bfc\u795d\u4f51
>> "%MAP%" echo 331005:567:\u5143\u7d20\u5e7b\u53d8\uff1a\u84b8\u53d1\u795d\u4f51
>> "%MAP%" echo 331006:579:\u5143\u7d20\u5e7b\u53d8\uff1a\u7efd\u653e\u795d\u4f51
>> "%MAP%" echo 331007:580:\u5143\u7d20\u5e7b\u53d8\uff1a\u706b\u5ca9\u795d\u4f51
>> "%MAP%" echo 331008:592:\u5143\u7d20\u5e7b\u53d8\uff1a\u51b0\u8349\u795d\u4f51
>> "%MAP%" echo 331009:593:\u5143\u7d20\u5e7b\u53d8\uff1a\u96f7\u98ce\u795d\u4f51
>> "%MAP%" echo 331010:603:\u5143\u7d20\u5e7b\u53d8\uff1a\u6c34\u98ce\u795d\u4f51
>> "%MAP%" echo 331011:604:\u5143\u7d20\u5e7b\u53d8\uff1a\u96f7\u8349\u795d\u4f51
>> "%MAP%" echo 331012:628:\u5143\u7d20\u5e7b\u53d8\uff1a\u8d85\u8f7d\u795d\u4f51
>> "%MAP%" echo 331013:636:\u5143\u7d20\u5e7b\u53d8\uff1a\u71c3\u70e7\u795d\u4f51
>> "%MAP%" echo 331101:223:\u5143\u7d20\u5171\u9e23\uff1a\u4ea4\u7ec7\u4e4b\u51b0
>> "%MAP%" echo 331102:224:\u5143\u7d20\u5171\u9e23\uff1a\u7c89\u788e\u4e4b\u51b0
>> "%MAP%" echo 331201:225:\u5143\u7d20\u5171\u9e23\uff1a\u4ea4\u7ec7\u4e4b\u6c34
>> "%MAP%" echo 331202:226:\u5143\u7d20\u5171\u9e23\uff1a\u6108\u7597\u4e4b\u6c34
>> "%MAP%" echo 331301:227:\u5143\u7d20\u5171\u9e23\uff1a\u4ea4\u7ec7\u4e4b\u706b
>> "%MAP%" echo 331302:228:\u5143\u7d20\u5171\u9e23\uff1a\u70ed\u8bda\u4e4b\u706b
>> "%MAP%" echo 331401:229:\u5143\u7d20\u5171\u9e23\uff1a\u4ea4\u7ec7\u4e4b\u96f7
>> "%MAP%" echo 331402:230:\u5143\u7d20\u5171\u9e23\uff1a\u5f3a\u80fd\u4e4b\u96f7
>> "%MAP%" echo 331501:231:\u5143\u7d20\u5171\u9e23\uff1a\u4ea4\u7ec7\u4e4b\u98ce
>> "%MAP%" echo 331502:232:\u5143\u7d20\u5171\u9e23\uff1a\u8fc5\u6377\u4e4b\u98ce
>> "%MAP%" echo 331601:233:\u5143\u7d20\u5171\u9e23\uff1a\u4ea4\u7ec7\u4e4b\u5ca9
>> "%MAP%" echo 331602:234:\u5143\u7d20\u5171\u9e23\uff1a\u575a\u5b9a\u4e4b\u5ca9
>> "%MAP%" echo 331701:235:\u5143\u7d20\u5171\u9e23\uff1a\u4ea4\u7ec7\u4e4b\u8349
>> "%MAP%" echo 331702:236:\u5143\u7d20\u5171\u9e23\uff1a\u8513\u751f\u4e4b\u8349
>> "%MAP%" echo 331721:581:\u6708\u5146\u00b7\u6ee1\u8f89
>> "%MAP%" echo 331801:237:\u98ce\u4e0e\u81ea\u7531
>> "%MAP%" echo 331802:238:\u5ca9\u4e0e\u5951\u7ea6
>> "%MAP%" echo 331803:239:\u96f7\u4e0e\u6c38\u6052
>> "%MAP%" echo 331804:240:\u8349\u4e0e\u667a\u6167
>> "%MAP%" echo 331805:393:\u6c34\u4e0e\u6b63\u4e49
>> "%MAP%" echo 331806:489:\u706b\u4e0e\u6218\u4e89
>> "%MAP%" echo 331807:582:\u6708\u4e0e\u6545\u4e61
>> "%MAP%" echo 332001:241:\u6700\u597d\u7684\u4f19\u4f34\uff01
>> "%MAP%" echo 332002:242:\u6362\u73ed\u65f6\u95f4
>> "%MAP%" echo 332003:243:\u4e00\u63b7\u4e7e\u5764
>> "%MAP%" echo 332004:244:\u8fd0\u7b79\u5e37\u5e44
>> "%MAP%" echo 332005:245:\u672c\u5927\u7237\u8fd8\u6ca1\u6709\u8f93\uff01
>> "%MAP%" echo 332006:246:\u4ea4\u7ed9\u6211\u5427\uff01
>> "%MAP%" echo 332007:247:\u9e64\u5f52\u4e4b\u65f6
>> "%MAP%" echo 332008:248:\u661f\u5929\u4e4b\u5146
>> "%MAP%" echo 332009:249:\u767d\u57a9\u4e4b\u672f
>> "%MAP%" echo 332010:250:\u8bf8\u6b66\u7cbe\u901a
>> "%MAP%" echo 332011:251:\u795e\u5b9d\u8fc1\u5bab\u795d\u8bcd
>> "%MAP%" echo 332012:252:\u5feb\u5feb\u7f1d\u8865\u672f
>> "%MAP%" echo 332013:253:\u9001\u4f60\u4e00\u7a0b
>> "%MAP%" echo 332014:254:\u62a4\u6cd5\u4e4b\u8a93
>> "%MAP%" echo 332015:255:\u6df1\u6e0a\u7684\u547c\u5524
>> "%MAP%" echo 332016:256:\u611a\u4eba\u4f17\u7684\u9634\u8c0b
>> "%MAP%" echo 332017:257:\u4e0b\u843d\u65a9
>> "%MAP%" echo 332018:258:\u91cd\u653b\u51fb
>> "%MAP%" echo 332019:259:\u6e29\u59ae\u838e\u4f20\u5947
>> "%MAP%" echo 332020:260:\u6c38\u8fdc\u7684\u53cb\u8c0a
>> "%MAP%" echo 332021:261:\u5927\u68a6\u7684\u66f2\u8c03
>> "%MAP%" echo 332022:262:\u85cf\u950b\u4f55\u5904
>> "%MAP%" echo 332023:263:\u62f3\u529b\u6597\u6280\uff01
>> "%MAP%" echo 332024:264:\u7434\u97f3\u4e4b\u8bd7
>> "%MAP%" echo 332025:315:\u91ce\u732a\u516c\u4e3b
>> "%MAP%" echo 332026:316:\u574d\u9677\u4e0e\u5951\u673a
>> "%MAP%" echo 332027:317:\u6d6e\u70c1\u7684\u56db\u53f6\u5370
>> "%MAP%" echo 332028:331:\u673a\u5173\u94f8\u6210\u4e4b\u94fe
>> "%MAP%" echo 332029:332:\u51c0\u89c9\u82b1
>> "%MAP%" echo 332030:347:\u53ef\u63a7\u6027\u53bb\u5371\u5bb3\u5316\u5f0f\u5b9a\u5411\u7206\u7834
>> "%MAP%" echo 332031:360:\u6d77\u4e2d\u5bfb\u5b9d
>> "%MAP%" echo 332032:394:\u5e7b\u620f\u5012\u8ba1\u65f6\uff1a\u0033
>> "%MAP%" echo 332036:405:\u300c\u770b\u5230\u90a3\u5c0f\u5b50\u6323\u94b1\u2026\u300d
>> "%MAP%" echo 332037:406:\u5654\u5654\uff01
>> "%MAP%" echo 332039:418:\u9f99\u4f19\u4f34\u7684\u805a\u9910
>> "%MAP%" echo 332040:430:\u9540\u91d1\u65c5\u56e2\u7684\u8336\u6b47
>> "%MAP%" echo 332041:442:\u5f3a\u52b2\u51b2\u6d6a\u62cd\u6863\uff01
>> "%MAP%" echo 332042:452:\u71c3\u7d20\u5145\u76c8
>> "%MAP%" echo 332043:459:\u5c0f\u5d74\u950b\u9f99\uff01\u53d1\u73b0\u5b9d\u85cf\uff01
>> "%MAP%" echo 332044:467:\u4ee5\u6781\u9650\u4e4b\u540d
>> "%MAP%" echo 332045:475:\u56f0\u56f0\u51a5\u60f3\u672f
>> "%MAP%" echo 332046:488:\u98de\u884c\u961f\u51fa\u51fb\uff01
>> "%MAP%" echo 332048:490:\u5065\u8eab\u7684\u6210\u679c
>> "%MAP%" echo 332049:504:\u6536\u83b7\u65f6\u95f4
>> "%MAP%" echo 332050:505:\u5f88\u68d2\uff0c\u54e5\u4eec\u3002
>> "%MAP%" echo 332051:515:\u300c\u90aa\u9f99\u300d\u7684\u82cf\u9192
>> "%MAP%" echo 332052:516:\u65c1\u767d\u7684\u6ce8\u811a
>> "%MAP%" echo 332053:517:\u7834\u788e\u4e4b\u6d77
>> "%MAP%" echo 332054:518:\u300c\u9b54\u5973\u004d\u7684\u795d\u798f\u300d
>> "%MAP%" echo 332055:519:\u300c\u72c2\u6b22\u8282\u594f\u300d
>> "%MAP%" echo 332056:531:\u7940\u73d1\u5728\u6614\uff0c\u7075\u9526\u6b46\u8bda
>> "%MAP%" echo 332057:542:\u6c34\u4ed9\u5341\u5b57\u5927\u5192\u9669
>> "%MAP%" echo 332058:543:\u62ef\u6551\u4e16\u754c\u7684\u8ba1\u5212
>> "%MAP%" echo 332059:554:\u300c\u7a7f\u8d8a\u6668\u972d\u7684\u5192\u9669\u300d
>> "%MAP%" echo 332060:568:\u5929\u624d\u7684\u6539\u9020\u6cd5
>> "%MAP%" echo 332061:569:\u53ee\u94c3\u54d0\u5577\u519b\u56e2
>> "%MAP%" echo 332062:583:\u6e05\u626b\u65f6\u95f4
>> "%MAP%" echo 332063:605:\u5c0f\u5c0f\u7075\u8548\u5927\u5e7b\u620f
>> "%MAP%" echo 332064:606:\u79d1\u7814\u7684\u52a8\u529b
>> "%MAP%" echo 332065:618:\u300c\u9b54\u5973\u7684\u8bfe\u4e1a\u300d
>> "%MAP%" echo 332066:619:\u9f50\u805a\u5171\u996e
>> "%MAP%" echo 333001:265:\u7edd\u4e91\u9505\u5df4
>> "%MAP%" echo 333002:266:\u4ed9\u8df3\u5899
>> "%MAP%" echo 333003:267:\u83b2\u82b1\u9165
>> "%MAP%" echo 333004:268:\u5317\u5730\u70df\u718f\u9e21
>> "%MAP%" echo 333005:269:\u751c\u751c\u82b1\u917f\u9e21
>> "%MAP%" echo 333006:270:\u8499\u5fb7\u571f\u8c46\u997c
>> "%MAP%" echo 333007:271:\u70e4\u8611\u83c7\u62ab\u8428
>> "%MAP%" echo 333008:272:\u517d\u8089\u8584\u8377\u5377
>> "%MAP%" echo 333009:273:\u63d0\u74e6\u7279\u714e\u86cb
>> "%MAP%" echo 333010:274:\u523a\u8eab\u62fc\u76d8
>> "%MAP%" echo 333011:275:\u5510\u675c\u5c14\u70e4\u9e21
>> "%MAP%" echo 333012:276:\u9ec4\u6cb9\u87f9\u87f9
>> "%MAP%" echo 333013:318:\u70b8\u9c7c\u85af\u6761
>> "%MAP%" echo 333014:333:\u677e\u8338\u917f\u8089\u5377
>> "%MAP%" echo 333015:361:\u7f24\u7eb7\u9a6c\u5361\u9f99
>> "%MAP%" echo 333016:431:\u9f99\u9f99\u997c\u5e72
>> "%MAP%" echo 333017:443:\u5b9d\u77f3\u95ea\u95ea
>> "%MAP%" echo 333018:453:\u549a\u549a\u562d\u562d
>> "%MAP%" echo 333019:460:\u6e29\u6cc9\u65f6\u5149
>> "%MAP%" echo 333020:468:\u5947\u7470\u4e4b\u6c64
>> "%MAP%" echo 333027:476:\u7eb5\u58f0\u6b22\u5531
>> "%MAP%" echo 333028:491:\u4e30\u7a14\u4e4b\u8d50
>> "%MAP%" echo 333029:532:\u6c89\u7389\u8336\u9732
>> "%MAP%" echo 333030:595:\u8f6c\u76d8\u7279\u8c03
>> "%MAP%" echo 333031:607:\u767d\u7075\u679c\u6d3e
exit /b

:menu
echo.
echo ===== Deck Code Tool (pure cmd / Winlator) =====
echo  1^) Decode deck code
echo  2^) Encode 33 IDs (3 characters + 30 cards)
echo  3^) 30 copies of one card
echo  4^) 3 same characters + 30 same cards
echo  5^) Lookup ID ^<--^> shareId
echo  6^) Search name (\uXXXX escapes)
echo  0^) Exit
set "C="
set /p "C=Choose: "
if "%C%"=="1" goto decode
if "%C%"=="2" goto encode
if "%C%"=="3" goto same_card
if "%C%"=="4" goto same_char
if "%C%"=="5" goto lookup
if "%C%"=="6" goto search
if "%C%"=="0" exit /b 0
goto menu


:search
set "K="
set /p "K=keyword (ID or \uXXXX part): "
if "!K!"=="" goto menu
echo.
for %%i in (!ALL!) do call :check_one %%i
echo.
goto menu

:check_one
set "ID=%~1"
call set "SD=%%S_!ID!%%"
call set "NM=%%N_!ID!%%"
if "!ID!"=="!K!" goto show_hit
call set "T=%%NM:%K%=%%"
if not "!T!"=="!NM!" goto show_hit
exit /b
:show_hit
echo ID !ID!  shareId !SD!  !NM!
exit /b

:lookup
set "K="
set /p "K=ID or shareId: "
call set "V=%%S_%K%%"
if not "!V!"=="" echo ID %K% = shareId !V!
if not "!V!"=="" goto menu
call set "V=%%R_%K%%"
if not "!V!"=="" echo shareId %K% = ID !V!
if not "!V!"=="" goto menu
echo not found
goto menu

:same_card
set "CARD="
set "C1="
set "C2="
set "C3="
set /p "CARD=card ID: "
set /p "C1=character1 ID: "
set /p "C2=character2 ID: "
set /p "C3=character3 ID: "
set "LINE=!C1! !C2! !C3!"
for /l %%i in (1,1,30) do set "LINE=!LINE! !CARD!"
goto do_encode

:same_char
set "CH="
set "CARD="
set /p "CH=character ID: "
set /p "CARD=card ID: "
set "LINE=!CH! !CH! !CH!"
for /l %%i in (1,1,30) do set "LINE=!LINE! !CARD!"
goto do_encode

:encode
set "LINE="
set /p "LINE=33 IDs: "
goto do_encode

:do_encode
set "n=0"
for %%i in (%LINE%) do call :push_id %%i
if "!n!"=="33" goto enc_count_ok
echo need 33 IDs, got !n!
goto menu
:enc_count_ok
set "raw="
set /a i=1
:enc_map
if !i! gtr 33 goto enc_map_done
call set "ID=%%ID!i!%%"
call set "SD=%%S_!ID!%%"
if not "!SD!"=="" goto enc_sd_ok
echo unknown ID !ID!
goto menu
:enc_sd_ok
set "P!i!=!SD!"
set /a i+=1
goto enc_map
:enc_map_done
set "P34=0"
set /a i=0
:enc_r
if !i! gtr 16 goto enc_r_done
set /a a=i*2+1
set /a b=i*2+2
call set "PA=%%P!a!%%"
call set "PB=%%P!b!%%"
set /a r1=PA/16
set /a r2=PA%%16*16+PB/256
if !b! leq 33 call set "PC=%%P!b!%%"
if !b! gtr 33 set "PC=0"
set /a r3=PC%%256
set /a j=i*3+1
set "R!j!=!r1!"
set /a j2=j+1
set "R!j2!=!r2!"
set /a j3=j+2
set "R!j3!=!r3!"
set /a i+=1
goto enc_r
:enc_r_done
set "last=0"
:last_loop
if !last! leq 254 goto last_ok
echo no valid checksum byte
goto menu
:last_ok
set /a i=1
:byte_loop
if !i! gtr 25 goto byte_done
call set "RV=%%R!i!%%"
set /a x=(RV+last)%%256
set /a t=i+25
call set "RV2=%%R!t!%%"
set /a y=(RV2+last)%%256
set "B!i!=!x!"
set "B!t!=!y!"
set /a i+=1
goto byte_loop
:byte_done
set "B51=!last!"
call :b64_enc
call :blocked "!CODE!"
if not "!BLK!"=="1" goto enc_success
set /a last+=1
goto last_loop
:enc_success
echo.
echo DECK CODE: !CODE!
echo.
goto menu

:b64_enc
set "CODE="
set /a i=1
:b64_loop
if !i! gtr 51 goto b64_done
set /a b=i+1
set /a c=i+2
call set "x=%%B!i!%%"
set "y=0"
set "z=0"
if !b! leq 51 call set "y=%%B!b!%%"
if !c! leq 51 call set "z=%%B!c!%%"
set /a n=x*65536+y*256+z
set /a c1=(n/262144)%%64
set /a c2=(n/4096)%%64
set /a c3=(n/64)%%64
set /a c4=n%%64
call set "CH1=%%ALPH:~%c1%,1%%"
call set "CH2=%%ALPH:~%c2%,1%%"
set "CODE=!CODE!!CH1!!CH2!"
set /a rem=52-i
if !rem! geq 2 call set "CH3=%%ALPH:~%c3%,1%%"
if !rem! lss 2 set "CH3=="
set "CODE=!CODE!!CH3!"
if !rem! geq 3 call set "CH4=%%ALPH:~%c4%,1%%"
if !rem! lss 3 set "CH4=="
set "CODE=!CODE!!CH4!"
set /a i+=3
goto b64_loop
:b64_done
exit /b

:blocked
set "S=%~1"
set "S=!S:A=a!"& set "S=!S:B=b!"& set "S=!S:C=c!"& set "S=!S:D=d!"& set "S=!S:E=e!"& set "S=!S:F=f!"
set "S=!S:G=g!"& set "S=!S:H=h!"& set "S=!S:I=i!"& set "S=!S:J=j!"& set "S=!S:K=k!"& set "S=!S:L=l!"
set "S=!S:M=m!"& set "S=!S:N=n!"& set "S=!S:O=o!"& set "S=!S:P=p!"& set "S=!S:Q=q!"& set "S=!S:R=r!"
set "S=!S:S=s!"& set "S=!S:T=t!"& set "S=!S:U=u!"& set "S=!S:V=v!"& set "S=!S:W=w!"& set "S=!S:X=x!"
set "S=!S:Y=y!"& set "S=!S:Z=z!"
set "S=!S:+=!"
set "S=!S:/=!"
set "BLK=0"
for %%w in (1s 2c8 2g1c 4jg 4jk 5l3 64 6four 6iv 6si 89 8jiu 92f 99bb a55 anal anus ass ash0le b00b b1tch b17ch ba9 bb1 bbw bdsm beaner bi7ch bimbos bitch boob boner c0cks c0n c4 cag ccp chink clit cnm cnn cock coons cum cunt cuum cv0 darkie dick dildo dilld0 dommes dpp dvda ecchi erotic f4k fag1t fagg1t faggot fck fdp fecal felch feltch femdom flg fm2 fuck gay gcd gdm ggc girlon goatcx goatse gokkun grope guro gwg hentai hitler hjt honkey hooker incest j8 jba ji8 jiba jiz juggs jzm k7 kike kinky kmt kock liu4 liusi lolita lsp m0m m2f mh0 milf mof0 nambla negro nignog nigga nigger nipple njink nmd ntd ntr nympho orgasm orgy p0rn p2np p3t paki panty pcp penis phuq pig poof poon porn pqp prr pthc pu55i pu55y pubes puki punany pussy queaf queef queer quim rape raping rapist rbq rectum rimjob s2x s3x sadism scat semen sex sh7t shit shota six4 skeet slut slvt smut sodomy spic spooge spunk suck t3k t41 t43 t4e t4i tits tiedup titty tmd tosser tranny tushy twat twink vagina vi4 viiv vpn vulva waf wank whore wh0re wtf x3r xdd xjp yaoi yiffy) do if not "!S!"=="!S:%%w=!" set "BLK=1"
exit /b

:decode
set "CODE="
set /p "CODE=deck code: "
call :decode_code "!CODE!"
goto menu

:decode_code
set "CODE=%~1"
set "TMP=!CODE!"
set /a L=0
:split_loop
if "!TMP!"=="" goto split_done
set /a L+=1
set "CH!L!=!TMP:~0,1!"
set "TMP=!TMP:~1!"
goto split_loop
:split_done
set "BYTES="
set /a i=1
:quad_loop
if !i! gtr !L! goto quad_done
set /a j=i+1
set /a k=i+2
set /a m=i+3
call set "q1=%%CH!i!%%"
call set "q2=%%CH!j!%%"
call set "q3=%%CH!k!%%"
call set "q4=%%CH!m!%%"
set "v2=0"
set "v3=0"
if not "!q3!"=="=" call :bval "!q3!"
if not "!q3!"=="=" set "v2=!V!"
if not "!q4!"=="=" call :bval "!q4!"
if not "!q4!"=="=" set "v3=!V!"
call :bval "!q1!"
set "v0=!V!"
call :bval "!q2!"
set "v1=!V!"
set /a n=v0*262144+v1*4096+v2*64+v3
set /a x=(n/65536)%%256
set "BYTES=!BYTES! !x!"
if "!q3!"=="=" goto skip_y
set /a y=(n/256)%%256
set "BYTES=!BYTES! !y!"
:skip_y
if "!q4!"=="=" goto skip_z
set /a z=n%%256
set "BYTES=!BYTES! !z!"
:skip_z
set /a i+=4
goto quad_loop
:quad_done
set "n2=0"
for %%b in (!BYTES!) do call :push_byte %%b
if "!n2!"=="51" goto dec_count_ok
echo bad deck code
goto menu
:dec_count_ok
set "last=!D51!"
set /a i=0
:dec_e
if !i! gtr 24 goto dec_e_done
set /a a=i*2+1
set /a b=i*2+2
call set "DA=%%D!a!%%"
call set "DB=%%D!b!%%"
set /a ea=(DA-last+256)%%256
set /a eb=(DB-last+256)%%256
set "E!i!=!ea!"
set /a tt=i+25
set "E!tt!=!eb!"
set /a i+=1
goto dec_e
:dec_e_done
set "IDS="
set /a i=0
:dec_res
if !i! gtr 16 goto dec_res_done
set /a a=i*3
set /a b=a+1
set /a c=a+2
call set "EA=%%E!a!%%"
call set "EB=%%E!b!%%"
call set "EC=%%E!c!%%"
set /a v1=EA*16+EB/16
set /a v2=(EB%%16)*256+EC
if !i! lss 16 set "IDS=!IDS! !v1! !v2!"
if !i!==16 set "IDS=!IDS! !v1!"
set /a i+=1
goto dec_res
:dec_res_done
echo.
echo SLOTS:
set /a k=0
for %%x in (!IDS!) do call :print_slot %%x
echo.
goto menu

:print_slot
set /a k+=1
call set "ID=%%R_%~1%%"
if !k! leq 3 echo  !k!. [char] ID !ID!
if !k! gtr 3 echo  !k!. [card] ID !ID!
exit /b
:push_id
set /a n+=1
set "ID!n!=%~1"
exit /b
:push_byte
set /a n2+=1
set "D!n2!=%~1"
exit /b
:bval
set "V="
for /l %%k in (0,1,63) do if "!ALPH:~%%k,1!"=="%~1" set "V=%%k"
exit /b