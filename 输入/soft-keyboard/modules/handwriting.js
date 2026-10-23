/**
 * modules/handwriting.js —— 手写面板模块（两阶段检索 + 多特征联合打分 + 用户纠正学习）
 * ------------------------------------------------------------------
 * 相对上一版的识别升级：
 *   1. 两阶段检索：先用「12×12 平滑密度 + 水平/垂直投影 + 四向能量」做轻量粗筛（约 2ms 扫全库），
 *      再对粗筛 Top-N 做 48×48 双向倒角距离 + 8×8×4 方向图细评，识别耗时从百毫秒级降到 ~15~30ms，
 *      因此字库可从 4520 字扩到 6500+ 字而不变慢。
 *   2. 特征更细：新增 12×12 密度图（144 维）与 8×8 四向方向图（256 维），能区分「日/曰」「木/本/术」
 *      「未/末」「大/太/犬」这类结构相近的字；全部特征用 Uint8 量化存储，单字模板内存反而更小。
 *   3. 多字体模板 + 笔画数精确分桶；常用字额外增加第二字体模板，覆盖不同书写习惯。
 *   4. 用户纠正学习：用户每次点选候选字都会累计偏好（localStorage 持久化），
 *      同字后续会被轻微前置，越用越准。
 *   5. 识别耗时统计 + 连续手写（上屏即清空，可关闭）。
 *
 * 挂载到 window.SK.Handwriting。
 */
(function (global) {
  'use strict';

  /* ---------------- 可调参数 ---------------- */
  var GRID = 48;                  // 归一化网格边长
  var GRID_PAD = 3;               // 网格内边距
  var DENS = 12;                  // 12×12 平滑密度特征 = 144 维
  var DIRG = 8;                   // 8×8 空间 × 4 方向 = 256 维方向图
  var DIR_DIM = DIRG * DIRG * 4;
  var PROBE = 72;                 // 模板渲染探针画布边长
  var INK_LINE_WIDTH = 2.8;       // 归一化后用户笔迹粗细
  var INK_ALPHA_THRESHOLD = 62;   // 二值化阈值
  var MAX_DIST = 40;              // 倒角距离截断
  var AUTO_RECOGNIZE_DELAY = 200; // 停笔后自动识别延迟（毫秒）
  var MAX_RESULT = 96;            // 返回候选字数量（支持多页翻页）
  var HAND_PAGE_SIZE = 8;         // 手写面板右侧每页 8 个字
  var DEFAULT_MAX_CHARS = 6500;   // 默认参与匹配的汉字数量
  var COARSE_KEEP = 900;          // 粗筛保留数量（进入细评）
  var SECOND_FONT_MAX_RANK = 99999;// 排名在此之内构建第二字体模板
  var THIRD_FONT_MAX_RANK = 99999; // 排名在此之内再构建第三字体模板（覆盖楷/黑/仿宋三种字形）
  var BUILD_BATCH = 180;          // 后台空闲每批预构建字数
  var LEARN_KEY = 'soft-keyboard-hw-learn-v1';

  /* ---------------- 内置字表数据 ---------------- */
  /** 内置 4520 汉字精确笔画表（1~25 画，桶内已按全局字频降序排列） */
  var BUILTIN_STROKES = {"1":"一乙","2":"了人又二入儿力刀几九十七八厂乃丁卜刂匕刁乜讠乂","3":"也上与大个下于已小才三门万女山口马干子乡么飞土久义凡广亿工千幺尸士亡己川卫亏叉习丈刃兀弓寸丸乞巾夕勺巳丫亍弋孑氵彳尢阝","4":"不为中与之从月日见内及无长天比分元手开心区太水今王书仍少气五反方仅风曰办文车火双六毛化云牛斗片木公引专计巴支升厅夫户劝止孔切父扎牙尤丹氏认互历勾乌凶欠仇订丑井允爪友卞什仁仆予匹勿仓凤丐午尺贝韦屯丰冈斤厄犬币兮尹介匀幻戈忆毋壬夭闩刈亢爿讥仄歹冗爻亓仑殳讣仉仃卅卬","5":"他对以去只可出由用它让号叫本们长市正外打头占处另生四东北写台发未主队左电白平加石且令右龙必汉古立半史记归皮代旧民世句田功目末包司玉布甲叶业扑击仙叹讯圣尔犯辽乐失灭兄仗瓦术穴鸟卡母闪尼丝扔讨议巨付宁永仪召充冬奴乎兰务册丘奶汇玄巧叩扒禾甩训艺示丛瓜幼甘汁邓卢帅弗申凹冯乍凸刊叮札仔矛斥仕矢孕氐叱乏饥旦丙轧汀纠囚叭央厉夯讪讫叨叼弁氾匝卯驭冉冮弘戊丕叵卮仡匆叽卟庀艽尕宄邛仨刍阡尻叻仞卉邝仝皿讦邙邗劢仟讧","6":"在有年地而她后多并好会向如再成各至当此同吃米问老自则死因约军名先回共全行吗字西次杀任边设州红早讲式动师岁场众光传买忙尽刚级合亦安冲收似血权论伤朱网关机色产团肉件江交考刘亚列臣守礼寺妈页节份孙决压齐负观华兴汗耳吓汤岂存竹争辽寻印异灯阳阵百托衣毕爷夺虫价戏屾尖羊吐闯许夹灰丢曲屼旨创吉吸闭划妃伏休庆执冰杂扩扫伊农扬刑庄壮充扣优朵吊访夷阶务伙池舌导欢兆驰妇肌汝仰伐羽伞尘舟伦吕奸伪宅夸扛巡纪圭吏企匠诀芝艾丞仿危协乔讳厌宇伍帆氖妄驮轨纨妆阮贞肋污纤戎伟汊劣讹吁匈匡尧邬仲朴讼氽迄艿旭纣伎牟旬驯圩讷亥戍曳屿巩臼吆圪厍讵朽乒艮乩乓汲弛忖闫舛讽汛玎汜缶戌迂芗饧凼刖囟祁纫夙芄芨汕芏氘芎芍讶玑忏钇纡阬佤聿扪凫芑阪吒扦纥尥屹耒圳扢牝圮圯亘阯刎吖伧伫旯圹旮阱汆圾犴邨囡岌邠屺伢钆讴伣","7":"我你来那但把时过里却更没走听成两即住达作每进应吧县张间快找均杨兵位身声低坐极报别初远完条系言体呀李足改呈乱村余似吴形男含块岛抓求饭状克层员何吨抢弄词攻投岗邦运批利坛冷宋忘坏折呆步忌纵诏吹姊围局鸡告纸志证杩角谷抗伸阳阵帐灵吾弟床饮劲君扶佛防沙迁尾扯护识亩赤严吸妖吻豆针役沉沟纯沪阴穷矣纲妙陆忍助抛壳库邪盯纳邻杖迟拟怀园私孝纹免忧尿译狂阻财肝秀钉闲伯沔伴戒卵希抖麦抚杆弃坑困抄祀犹返沈阶扭判杈汪评廷兑劫启拒闷牢驴良肚坟坚陀丽泛际技吞劳序吼吵灾医坊肠否究扮束串呜灶佣冻迈坝龟芯沐材驱汞杜妥寿伽佐巡宏纱秃卤鸠旱歼佑罕杉贡呛坠邑芒屁扳轩刨吟牡邢忒纬辛甫旷扰庑玛羌肖址庇坎纺亨诉辰匣杞违灼芜努抑妓冶杏灸呐肘驳诈吱阮狄邮佃估纽芸况诊犺坞抡邺邸苍沁沅矶钊纷彻甸庐抠妗汴疗攸呕岘皂邱芰佚吭吠岔陇迄呗巫孛扼伶纭妫佟庋饬闵删纰妞孜酉诃妒闳迅伺邵妍沃沧呃汽韧纾灿芷吮欤杠闰沏沂町杓饩坍沦芦励佥卣沣囤肛抒苇彷沛芟忤邹苁汾沥芋妤妨奁玖岐沤姒饨芊邯肟彤苄劬芤芪佞吡迂旸邳汶闶苌钋苡芡芾忱诒孚虬狈芹饫妊闱岚芎诌轫芍纶苣伲岑奂陂忻杌呒钌佗甬呋怄肓汰狁玘氚豕坂诎怅怆疔苎抟氙芈饪帏毐芩迓岜吩苈佘圻炀忾吣芴呔苊呓疖纻呖陉旰杅玕诋飏吝诅诂囱汨冏劭邶尪抉迕尬纮吲邰呙兕妪忐阱妧杧芘圾杄佝坌吽尨汧","8":"和的这到还或所其使事话国呢该受进者法连经些近学往非鱼明直定放金知初性远拉花河官变图府制转命怕取居物林现股周承供顶线忽卖画治空实姓刺底阿驻京诗房具奔届怪抱拍表单质凭油陈青尚枪运势卷招武板易虎依奇版组轮庙迎宝果炒闹抬雨卒细奉泥味始玩练姊弦环爬夜念苏狗波罗软试松社宜侧拖店沿呼宗补败岭肯视枚浅参注抽例审怔杯附废拔征佸叔刻抵芙呵佳岩垂斩终泡欧矿备拥货抹忠拨陆壳规驾采刷孤泪净邻岸迟拟担肩轰坤录径拆肥阻固姑爸态妻季剂典坡饱炉拐码帖押委舍枝咋肾肺祀披返茎彼炕刮姐哎岱杭鸣齿拒贤姆侍岳拌闸拦责陀丽织泛际苕劳服卦苯侨肿卧妾沾泄丧详购虏侄侠泊觅拚妹卸驼斧饰迫泼佹坦芯孟旺幸贪枕拂芳坪咀延昏析诛享账牧乳奈宠剁衫拣肃贫构昆拢绉诚畅贯炎胀茅芝怡兔驿择帕枉柜育饲杰枢泽卑拧乖陕隶胁怯咏芥昂屈枭佺呸拎羌函狐佩弧拈阜苑弥妮帘郊券顷昌芽贬於违佽泻芜贩玫沽昔庞咒钒枣肢绐绍诘驶钓卓劻盲邮祎抿忿弩玮奋芸矾杵衬佬昙凯绊贮欣迦怜迳泣邺邸苍苻芬秉驷拄拘肽咚拇帛邱朋峁绌炬苛拗炖拓郃陇沫炙苷咕拙宛帜侗苫钗沸刹询肤枫侦岬呷昇诞迤宕劾炊泾怂沮庖佯盂绁郅咎诡邵沼呴泗沓咄匦炆芷诠陌轭驹殴岣秆艰虱岫帙呦绋诓咔孢垄岢宓囷诧绅泌咝厕芦侣坯钍咂庚诤泳诩歧诜茉苇兖帚坨诙绂岷昕肪诟诨怵邹迨罔玠绀肴呶诖殁侃郓郏芭穹沱昉祆黾甾甙侬诔併氛邯泯忝戾籴苄奄驸怖炝昊泓诣炔瓯苤呱枋苋钖邳狍祁虮坳帑祇肮芹妯茏侥叕抻竺狎苴怦疝衩拊垅泠戗怛枇芫疟陂穸咛宙侈呤戕旻杳怫矸峄杲钏肷茚隹咐岵冼绎疚芩炜侑钎迩侔弢芮茓肱姗昀妭肼咖钕鸢邾泸佼沭泺肭朊屉肫砀孥侂妳厓矽叁陉氓泫泷炅帔杼畀疡坭拤芠彔妲岽怙邽冽钐茕坷杷茁郄饯钔邰侪枥玡饴泅兕怍刽狙驺侉剀姈杪枘玦侩垃驽泮祉侏垆怿狞苒刳匼坼攽昃","9":"是说要将给很看前便省带点南总者段派相按种城既若美重类虽面型指甚剑哪建穿信急亲待郡背故流须战项首某药活英轻皆架科骂院洞怎封觉挂举宫食拜复胜降界剉香俄树响冒贴保度赴咱厚苦绝春闻怒显语室贵星客毒亮恨挥奏持秒皇结帝挺致政炮钟咬查砍养胡费柄拱洗洲奖脉赵绕视挡顺挖独施秋浅挑亭临屋荆音思钢俩柳哈俘限阁品挤统炸测律罚剅济弯郎砖标牵津突绘威珊浓哄勇洪娃柱胪险峡误盼述饶洋狠贺泉柔砌郑垱饼胖冠烂钩扁胃俗俊削拾怨残虾叙轴绑哟茎钦疯尝宣耐哎垮歪侯革胆苗荡耍侵竖珍染眉拽钙苕郢耶拼炼咽苯挣盆洛娜姜哇珂诰洒枯氢垫恼姝恰奕砂剌卸屏迫虹钠昭荫钛贱狱闽范眨胎浑咦衫姹咳缸荤贷陡促彦狮钞狭姥栏幽茅哗挟哀俞挪窃饵哉盾拴咧研诲祐柜胈娇哑映叛陕挎畏恒浇禹柬炯钧茨祠胤巷迹苔郧饷骇笃恢甭绗瓮剃洺契勋茬姘茸屎苑绞挠郊兹毡氟绛姚蚁栎络迭诵胞逊咸垒钨钡括厘咯勃诱蚀荐咪枷迸怠迥迪娆盈姣俏钯昧玻炭茂毗衬恃洁柑胚迦袄垎姨钝浊荃绔拭恍览绒茧侮柏砚姿苟泵恪茫贰帧玹峙俟哒苞郝疮栋俅趴垚陛轶宪癸竿柯峣炬洄珈垣浃苛衍庤俑垦垛骆洿栅柿鸦宦诬骄浐盅剐虻烃贸拷茗昨炳孩恤宥疤炰闺垢哂阀炽诫斫笈珅徊茄恸诳亟柩妍郁昼矜枰涎虼洓栈洹炫酋钤玲陌咨俪炷奎祈闾洼虐胄垓荚鸩珀籽哆浉恻恺狡疣咭骈俣胫怼勉姤牲俨爰柊蚂娈陨姞洌茉茜钚哐陋祛疫俭娄狲栉洽囿鸥钥咣珑哝贻姻饺垭诮盹苹洩烁俚钪牴胍挝浔闿茵砆荩胧钮祚瓯竽柚哕昵狩牯荨苡胂贲氡衲洮祗俦叚垙娅庠峦柢祜泚胥孪栊恬骁殃垏殆珐闼垯姮洸俎呲咩韭厖荪袂弈峤垵曷柘咿咴庥昴衿洳钜钫皈弭挞砭浏徇钣鸨匍拯胨虿垕姱恂朐竑籼赳迩峒峋柞砑砗砜俜枳毖莒轲荞昪砉胩虺屌哌炱恫昱祓殇柙阂垡浒轸砘姽恓疥胗畈眇祢羿衽钘玳咻峥枹胙郜哏垟浍胛觇弇恽拮挦昺眈砒祏茴洵拶耷荑飑茱哙昫殄胝茭邽苓彖罘洱茕哔栌郛酊畋咤栀炻瓴荠挢哞浄昶荇挓畎窀羑洑洧炟郦飒宬浈钭卻徉洇狨轺俐苒柝柰殂烀茔","10":"将能起高家笑较称谁请党站倒啊真拿难钱原除爱部送涓神哪热茶郡海座酒流罢破宽病铁桥药获兼特调哭退差选浜院谈诸留敌帮换修草追紧读根值鬼旁夏贼射垸烧逃唐班绣哥浠素赶盐哩借套倍格核乘娘骨烟圆顾挺准害陪烤舰恩哦载般笔爹恶涔哼弱脑案课袁陵秦扇氨校料透旅配狼珠容颁顿俺浣缺脊轿监积唉朕埋捉钻粉继徐样俱砸胸递峰涌拳徒捕涨租档烈展饿倾贾祝疼臭瓶剧疾翁险铅荷润捏埃消挨翅娥哨鸭唤柴恐凉迷资祖席珞莲朗息晋晃健索桃粑晒涂诺浮壶残症斋候逆舱袍陷氧泰晕窄皱砰捣烦荣釜荡浆恭浪娟捡竞桂卿倚悟航娜荒宸袖烫剥损秘捐盏宴捞桌脏挽浩娌浼畔倘胶莱逛唇羞恕振途烘栽眨烩冤衰娑效涉荤宰株桑陡适豹瓷耙桩艳埌悔铀浙捆阅捎预涘辱挪栖耕脂钾娉债畜脆虑涅绢殷捅匪眠耗颂铃茨祠钴迹浸耸殊宾娴顽逍俯恋庭烛茸珰桨哲益毙晓捋蚌冢桓逝娲涛唔俸捂谅冥逊验挫朔砥胯逗桦窍悄荐迸屑彧躬疲逞钵蚕涟峨姬凌衷浴恳胺氦倭晏袄倦浦秩珪荃珮秤涧烙崄涩恁茧宵绠茫础悖铂峻殉框钼脓耻蚊郝悦圃翂晌唆涞珩涢舀浚耽晁倡剖钳娓砷悍栗隼玺倪娣琉俾茗辂盎绥涡奚哧倏埂绦隽峪罡矩衮趸恚胰谊酌狻桐剜桅哺蚧涣莆涝铎莉耆袜栓埆笆骏笋峭凄虔涑贿挚舐鄀荚痈晖谀眩钽桔崂馀铌祧陨耿剔茜鸵倞珛鸬祛倔蚜凇涤倩谄铋砾烻桡砺脐氩郪崃聂铍婀龀皋衾梴梆痉砻荀耄旃赀胱恣珲娱倌叟郴诽骊蚤茵钺疹笫桀唑埗骋涕屙浞俳悯悚倓旆桁赁赃亳袒凋烊蚩钹哽狸鸳诿衲厝蚬蚓莅疽蚝鸮埔笏袅桠捍挛阆砧祯蚋诹旄栲绡鸱捌疍桤浡涠眬蚍逋逑铊耘舥荔俶悌莸衄孬笄挈蚨茹砹谇荻赂袂娩鸯勐琊畖笕鬲晟舫桧痂疱紊秣倸豺臬砣唏晔埙畚祟逦绨阄窈琤邕秧鸪荥唠铆倨哱趿钿埇砫莼荧珒谂饽羔偌哮诼桉荞浯袢牺铈馁畛莪郯蚣氤鸫鸲屐酎铉莞奘罟栱蚪陟牂荦阃烬逡铄烨埘笊酐陬砝谆扆胴舯莳栩倜敉盍贽鬯烶鸶荟脍桢剡烜逖胳娠茱悃颀骎倖挹逅哿珣珫莨逄恙埒栻捇郫倬哳唣盉脒荽陲莓郸荇倧秫趵挼珥徕栾钲唁唧朓珙鸰郦莠悭桕砟赅钷倮剕疳莩","11":"都着得被做副第啊据清您部常教望黄竟深脸接啦离通宽随眼率惊情鄂掉获船断理领脚推救章职银欲停晚铜球颇族假御略弹骑唱渐雪盖祭虚够密蛋商排堂盘偏脱梦绿陪啥基猛移郭盛猪莫造婚捧混累陵授斜跃透袭睁圈粗偷寄辆堆鸿蛇探猜票掷彩递盗曹娶减梁速患兽馆甜谋颈悬勒鹿瓶麻荷维液缁隐庸剪掩乾莲衔健野梅淡庵惧婶添凑窑粘敏掘袍陷绮淑淮崖菌谓湴谜掠堵祸旋惨惯赦粒焖舵域梨续盒控兜崇康梢绳袋辅袖硅萨唯逢偶笛逐惟铲谕笼莱逛铝荫羞宿敕途谏掏敝啪焉聊售符渔徙械匾瓷捷陶唬桶悉婆彬梯铮堕曼莎巢啃检绾庶祥痒爽逻猎捻崔趾梗铬逍捶喵梭掀崩惜婴婢淫犁盔雀梳逝笨笙敛啄淋谐棂隅掐掳厢眯勘晨啷淘梓绷痕彪绽硕淇寇逗渊毫淤谌淌逞描淖渗谎谒偕谝舂绵笺啸渚堑偿戚绸缀涵谛尉铭莺脖喏眷绫袱阎淳窒琅帻孰崚掖猇啰绱绯矫聋晦唷谑淹培综婊秽鸾萝琐梵渎啐萍酚屠阉绻琉皎掂龛铣躯淞蛊寂帷焕掺措烹莽婉赈铏鸽奢铡绰掸袷阊匙衅埠铐绺笠捺颅烷龚唰偃渌涎绪焊啤舷硌琏莆敖硒馅唾梾捱莉偈旌烯斛袜蛆荼绲铳偎祷崧渍埽惭啵绩硎娼铰淬蛀笞眶痔铩淝蚴婕莹鄄凰涯菇悠掼淀阐寅淙铠殓涮谙匿悼痊铢悆婀谖蛏谗涿笮翎焐晤秸掇聆堋豚阇掞舶裆硐阈婵畦梧恿悴惇掬笱郴涸萘圉羟谔铱菏馄笥绶厩辄蛉烽匮淦翊铯赊氪惕冕厣酝羚焘崛袒啜戛焓笤婧啬粜脘蚶铵萜惦菁谘崤阌崡涪谚啧铷疵涫羝铙悸阋晞脲裉彗淄弶淅淠淯舻猗扈崎蛄鸷眦琎梽鸺笪笸荻掮铨晟砦啖硗菰鸹脯窕琇骓晢啮铟堇笳粝逯啡唿堃硖秾菪郾崭阍惮趺铪笾粕勖崟捽旎瓠萤殒唳筇蚰蚱匏阏偁菔渖匐莒蚯偌梃烺珵赉啛铧偻袢惘啉勗萄棻舴菽偓蛎铑毬猝铛崮郿唵莞莘惚棁崆庹弸萁铖猖眺硇胬逶偢掴逡惛桴耜眸徘馗谍舸晗啶婼逭麸埭硙赧惆舳菅鸸崞菟崌悰铚婪菘啭渑隗蚺堉惔畤菹菡跄惋梌崕埜酞勔啁萋隍挲悻崦翌萆趼铫採郫偾晡牻铓蚵硃莓梿郸婳菝袼彫偬啫硭惬莠媖崒袤脣骕菖埝淆焗眭觋","12":"就都等着最曾属强越朝湖跑黑黄提量喝落掌街菜象鄂敢喜游装铺期短集著紫善散港替硬答御喊稍距斯插超隔湘然痛确韩编智盛牌棣猪搭联登塔雄温番廊富荆锅谢税棒赏赐幅握喂筑跌尊遍搜渡程窝奥缘湿湾寒景阔趁猫慌剩割棺缓童筋骗疏棉琴策堤愣锌窗款隐鲁隆锁堡喀稀裁裂暂赋揪普辈搂趋猴焦喷菌筒腔祸棋棍链蛮遗屡窜粥揭赌隋菲雅铸援彭斑蒋揉凿戟欺渝搁艇嵌渠傅粤晴棱脾萧锋酥循椒禅赔搅销裙喘棵释嫂窖悲椅菊辇揖喇博棚堪惠嵋帽逸颊森硫裕葱皖鹅琳堕氮粪雇滋寓搓腊逻溅喉棰蛛晶斌焚琛腑谦植揽甯逮翘揣缅媒鹃辉渴氯裤棘愤舒蛙傜揩溃蛟储腕殖掣琼隙惺缎腌萼棕馋滞椎赎堰菱谟椁践雁椋渣蛔傍瑛厨描貂谥募斐舜搀锐孳椤愧棤渚赍嗟愕筛惶锏搔隘嗒釉喏袱跋锄琚铿粟喻皓锑厥喽惰敞厦翔焰喙晾棠掰媚颍啼愉敦酣萝絮缇萍喧缉缕渤鹄惩屠揍缂竦锂傲渥筐嗖缃葑飧筏畲腋蛭渭筝晫湍跛傣琢窘骚奢缒惑硝婿羡焙黍葵颌辍锈啾颏痢痣萌鼋痘畴毯奠鱿祷祺搽傕淼詈蛤巽暑椟硷渲缌颉谡寐犀婷阑弑筜缆楗蛩飨硪菇馈猬畬锆喔犊弼亵缈媛遏辜谣鲂谠酢嵁幂湜犍傩椭掾愠棬痪渺锉彘裆牍猩崽琦揿萘湟菏琵缗惴甥阕皴馊湫萃谤焯琪腓崾睑萜蛰蛘喟菁菀蜒鹆痧慨湮椰棹锕湎猱瓿蛴谧腆崴喳庾睃蛑惫琶菩缄湛遑锊阒翕啻溆跎跗徨湃焱氰靓喾萦锇蛞腈鲀揆锒婺葆蛲喋嵘萎锓辊葭塄喁琮榔喃蛳骙晷舾逵湓猥觚觞缋萤喹遒蛐摒溉溲喑嵝跏幄堞媪锍嵯椆湉琯覃萄腚蛱鹁蜓猲痞媿堙愎珷痨铼缔飓壹矞翚鄗滁愦牚锔聒蒎扉愀裥跖睍傒嵎嵫欹萑靬湄廆粞赑骛痫傉嵛湔揎裢菟筅粢菘棓殛毵湝跞赓琰棫觌跚颎喆菡鹈椐渫湣缑鹇晰锎遐腴傥傧焜矬腱锃揄斝楮酤馇鹂衖殚堠猾嵇棐椓溞裣跆愔渰稃蒌裎喨睐巯酡睏雳琬辎傈腘裒辋焼搥幾搰孱竣棽稂骘菖晱棨睇祾絜腙葜","13":"道新想跟像路意锛置数满随群落跳搞睡殿错楼著营解暖感腿照微楚摆遂罪源献躲逼腰跪遇粮暗碗搭毁塔滑输塞搬跨温滚摇鼓愈蜀歇煤煎嫁煮嗯碎遍搜傻锦雷慌碰葬誉零碑溜辞禁嫌瑜辟阙摄惹腹雾缠幕缝督蒸禀敬催填携嶅溪滩矮蜂腾罩锡嗤赖愁签遗缚蒋萨董窟锰跺鼎简艇触瑕滃瑰叠裘痰塘煨禅溶蓉嗣摊谨骞频鼠裙滨筹瑙锜盟嫂键逾瑞韵滇剿楞塌裕葱龄酱锥慈煌勤腻锤搓辑署斟鹏煞嗐睦虞遥滆鉴槎嗔猿詹碘靖聘痴碍腮愚颖窦裤嗜腺肆廉酮搏裸蒂滥嗅蛾窥寝酯酬概慎幌褂腥蓄戣颐靶葛衙嗳禄愭塑锣锯募舅萱褚楹嗨瞄楂魁鹊愧靴馍漠禽辏蛹锭葡鲍搔隘嗒溴阖溯裔碌瑟暇龅鄙馐睛槌嗛溢遁椹牒鲌滤槐楠雍障硼睬瘀谩稠缙椿嫉搠嗦锚嗡楝稚嗬傲豢筷慑嗖瑁蓟睢榆跷雉彀塬溺嵩酰葵辔锢跤氲谬畹蜕觥幙嗵锗睹瑗漓祺搽毓鲇暑煲痹慊搦缡媳碉鲈嘟裨辐嫔粲徭缟鲎鄣榄嗷煳缢腭髡煜窠龃颓搧遏嗄鲆跫艄遛锨楷雏滦滂摁椽飕甄骰蜃碛嗝龆粱睨楔碁雹貉裱骱嗑谪椴嵴毂韪酪嗓楸麂亶蒴嗍尴筶锝歆摈窣媸嵊颔缣跸鹑椰嗲阗愆楙榈羧畸嗌锞鲋搡蓖煊嗪楦跣暐跶誊楣溏稗裾滔韫溍艉蜗碇溥煦愍暅锖锩煅葭蓦搪蜇缤榔稣綈缜嗥遄媾蓑跹嵬筦筮遒缛跻溲暄旒楫碓裼锘睫裟嗉嗫蒱蒽蜓猷鲐徬敫榇瑄碜鲅稔皙裰鄢剽暌煺滁靳愫瑀碚雎嫒锟嫫戢楯榉滏罨骟溟痿筱蛸腧锪锬溧煸鹌蓓滓鄜鲉媲嫄鄘骝貊遐粳剸榾馏搛鄞猾蒹廒瑚煁跬溼戡戥鲏嫋搐蒯腼腩腠觜訾痳","14":"像管满需算辖愿墓端墙腿摸寨僭精境僧酸旗嘛遭歌蒙福演赛蓝舞慢嘉鲜聚静摔谱嫩缩颗膜敲稳榜赚遣鼻碳察瞅磁幕熊滴蒸截碧裹厮熬酶魂豪摘漆疑翠睿漏誓舆雌辣碱嫣熙瑰斡遮貌蓉漫箢搴摹蒿碟慈榻署蒲镁赫遥褪槎弊谭蝉腐韬踅漩愬锺箍熏蜡麽寡蒜瑶裸熔暨撇褐蜜漂褂蓄凳酷嘎磋膏裴慕廖墟榨瞄箫箕魁镂漕漠骡舔筵歉蝇夥榷撂鄙熄隨槐嗽嘤鲛障嫡箐竭榭夐摺榛嘘彰瑧髦蔽鼐肇蔓雒摧翟膊蔷魅煽槃酿锻幔僚墒槛僮漳廓鹗氲榴獐嫖蔚赘锹寤缨嘀瑷孵蜥毓臧镀閰禛龇嘟漱瘟箸叆踊睾摞蔼榫锶嘈嘣谯锾蓼膀兢漾遛蔪箩蜷慷犒飕甄蔫骰嘁榧辕鹘蔗嫭嶂缪鲑槊鄱裳銮裱镅窬膈辗潇龈蒴碴缧锵粽馑瘘缫碲箔隧慵骶潢蜒嘌酵糁缦寥儆魃璈遯韶窨嘞蜱霁鲖榕锸僖骠靺骷蓦箧罴碣夤塾箓鄯靼鞅缥窭蓑嘧蕖褡锷罂嫦粼潍殡鹜榖蜚谲鲚嫠熘漪銎踉僦艋酽鹕嫚鲟霆嫪槔罱镃粹僰嘏谰锲潴旖嗾嫱槁锿蓿瘈暧箬幛嫘裢漯撄槟瑭箖锼蓓暝劄觏镄摽箨褊徳翡漉劁睽谮飗鲔鲕嘡摭獍豨墅魆鲝蒹璃槠酹鹚膑墉榍瘕箅箪綦蓍颱箝蒯鲞鹛螂蜢蜮僬潩膂屣榱蔸","15":"镇德靠嘴题熟横懂撞篇箭躺遭艘增踢震瞎镑额璇影撤撒瘦摩踏醉潜槽潮墩鞋瞒飘劈擒稿撑寮蕲蔡墨踩熬箱撰璁鞑模潵磕鹤醇撕膝豫憋潭撮遮镍鲢暮遵噢醋暴嘻黎澳馔敷磅趟播澄瘤璋潘慧糊蓬鞍鲤碾撬鲨镐毅僵篆嘿凛幢稻慰撩噗颜膛嘶磋霉慕踪墟墦撵澜骸熜樱稽僻履幡趣憨撅樊镏嘱稷魄觑鲩蝶瘫磐蝗缮髯噶樟蝎镉蔽聪蔓噙噎羯蕨撸蔷戮魅熵滕蕴嘭踞谴蔚憎潟槭嬉畿瘟鲧褥魇褒鋈颚稹镌蔼瘪虢瑾蝌熲噜龉噔觯鹞徵缬蔫踔瘛鲫嘲暲蔗獠瘢鞒踝蔬奭蝠熨赜箴缭稼翦懊磊踮噘獗憧蔑篓蕙嘬頫霄潢龊璀樘撺潦麾噌缯璜镓槼澎嶙樗膘澈靥镒噀樯獒蝰骺勰褟憬骷瘠適橡槿谳踒踦镆餍殢艏骻觐槲磔薡馓潖醌蝽澂牖赭骼殣辘幞窳羰耦褫颙齑瘝霆蕈镕褴儋橄瞑鹣墡篁镎蓿熳箬蕞蝮镊潼撷耧憔鲣蔺蕺慝皞璃澍糇遹鲥蝨墀嘹遴鹡潺螂翩廛","16":"嘴器糖澶操艘雕糕醒避壁磨整寰辨镜燕擒蕲赞濂邀激辩褰擅黔镖霍豫薇凝遵噢膳薪澧篮澳鞘颠餐赠澹蕃儒默懒融燃褪瞥橙缴靛踱螭鲸亸蹄冀穆橱璘螅骸膨镞瞟熻霓濒蟒衡缰踹憨飚螨樵醛霏瘾橹蕉噶斓褶圜臻髻擂噬缱翰蕨璞濊澡镗篷瓢擎蕴赟蕊撼懈瘸潞濉篡磺濋橐嬖蕾醚噪螯燧橘褥甑魇擀擞獭镠憾噹橇遽璟噫篙壅穑翱犟獬瘴燎錾濛踰霖樽瘿懊糙廪磬廨熹薮蕙篱隧飙辙鲱霎璜嬴颞歙羲彊懔鲷儗暹螈踵憷耪螟髭薜劓赝魉橛鞔嬗鲵橡氅隰鹧縺窸憩樾薨鲭罹鹦骼鹨鹾薅篦髹璠蕈鲲鲻瞠噤褴橄噼暾耨辚魈橦鄹蕞麇盥禧薙瞰鲮徼甏鲴薏麈檠蕹濑颡疁膦噻墼燊瘰鲳獴鲶噩遴噱嬛橼燔盦","17":"瞧戴懂襄擦薄赢避瞪臂蹇檐磷翼邀繁薇霜糟藉鳄薪螺薛癌濮檀爵濡辫礁鳃磴霞壕徽臀穗簇燥嬬骤曙蟒璐簧醛瞬龋黛糠嚎擢褶赡豁濞檄懦濠篷擎壑蟆謇鹫藓磺鹪嚓罄糜黏膻鍪曚蕾瞳罅醚蹈闇臊镦燧镫膺蹋镣檬髁鞠遽薯疃羁螫孺黜蹑觳糙鳅篱簋龌薹濯繇臃蟀嬷襕縻濬鹬魉懋髀篾獯隳罽嶷鲽懗貘鼾翳擤瞭醡癍鳊魍燮镧鲼嚅璮蟊藁麋瞩豳朦黝艚擘甓谿鲿鳀藐薷邈罾擿醣镢瞰黻篼醢鳉療檞璨鹩臆邃嚏懑櫆璩鳁嚇簌鞬簃濩礅","18":"藏翻藕魏鞭璧戳覆鹰鳌藉藩藤鳍蹦瞻彝蹙曙襟蟮簧鞯鳎蹚瞿薰镰懵蟠鞣瀑癖簪雠檬镬髁镭薯鬃曜藜鞫鼬嚣蟛癞矇镯醪簟鎏鹭鏊髂餮鞨鳐臑蟪鹱魍礌鬈曛蹠瞽藋蹩朦皦髅釐鼩馥藐簠鹮檫黠鳏鳑襜艟","19":"藕颤爆瀛蹲鳙攀蟹藻羹簿警嚭藤鳔蹬攒鳖蹿儴瓣疆蟾蹭襟麓麒靡嚬谶懵黼魑巅鳗醮醯蠓蹼鳕瀚霭蹴蠊曝蠖鞴彟髂蘅鼗癣籁鞲蹶儳骥蘑嚯籀酃髌襦髋髅醭蹻藿艨鏖攉麴羸鳚鵰鳓鳛蹽蹾簸","20":"魔瀹鳞籍嚷藻嚼瀵璺警獾耀壤孽瓒鬓糯巍攘躁纂曦馨鼍酆孀醴鳝镳霰蘅黥鶗蠕矍鳜譬髋藿蘩醵鼯鳟骧甗巉臜瀼","21":"魔露灏灌霸赣夔獾麝蠢髓巍醺癫禳鼙蠡亹颦黯鐾齎瓖瓘蘖曩罍","22":"囊龢镶懿蘸饔饕霾瓤鬻穰鹳蘼驎髑攧","23":"罐蘸攥髓麟趱攫颧鬟蠲劚臢鼷癯","24":"灞罐矗衢鑫蠹襻","25":"馕纛鬣戆攮囔","26":"蠼","28":"钁","30":"爨"};

  /** 内置 4520 汉字全局频率排序串 */
  var BUILTIN_RANKED_CHARS = "了是在和有他不我的人也为就这上年中你说一到都等着对来与地还要又大而之道以得她个后去将那但从月下把被于时只多过可并能好会出或日由里用所向已其给很看使前新想却它最见起小高更如再才便没走做让内及听成各事号至叫两当三本无此们家长市门正同吃天比米外即分问话打老自副跟笑则像较国死省住万因曾元呢手达头作该女开路约军称名二每属谁受带进先应吧县心占处区太点水南张今间总回山请者党段法连站第共另生全行倒快派啊相吗经按找口均种字入真拿城马干王据四子书仍难西东少次些钱北气近杀清学强写既若往台原发任美未杨兵非除边位鱼明设州直定越身重声五低坐儿极放金红朝爱知主您报类早虽面别初性型讲部送远反指乡方甚常完意队涓式左拉花电锛条剑神动湖河白官师仅教哪变图平府热制望岁转建命加管场跑穿众么黑怕风信置急石黄镇取光竟力数曰亲传深脸买接茶且办待文提系量忙尽喝郡车啦刚背级离故言海体座酒通满呀李令飞流德足瞧合右罢亦改刀破龙需宽必病随须居呈汉群算战眼安靠藏落项首掌街铁物林土菜现率火桥股象古跳某惊搞药冲双六情鄂掉立乱周几承村收半供九活敢余获兼十特船顶断似毛调吴形线忽七久史辖英卖血画轻皆治权哭空记男八喜论伤架归退游实差姓朱网皮刺睡选科关化浜骂底院含洞机色阿装理驻产铺领块怎封谈诸觉团肉期岛代短旧嘴挂留民敌京诗愿墓世殿举帮抓换件求脚房宫云食错牛拜饭推状复句克救楼胜具斗层集著片奔章届木怪江抱职拍交表降田营修考员银欲何停界解草剉紫刘善香单晚吨亚抢弄列质铜词厂暖感凭追紧题臣油读球守俄功端散公义攻陈礼青引投目树寺岗墙颇尚凡邦根末枪运值港响势鬼批包替司卷旁夏招武冒族贴硬利坛冷玉腿答保照假板御易贼妈度宋专熟计忘赴射页乃垸巴咱支厚烧微虎布节升依苦绝翻逃唐春闻奇略甲楚喊班份广怒孙绣版坏组叶轮哥决浠压弹显语室业摸庙稍素扑赶迎宝果贵炒闹抬齐雨骑盐卒星哩客摆借负折击戴细呆奉观唱华毒泥味渐横始亮套兴步仙雪倍汗耳格忌核纵器藕遂玩练罪盖距寨吓乘厅叹恨祭诏僭斯吹虚汤够讯姊夫弦环精户挥爬岂奏持亿夜源围局圣懂存秒念娘骨插献境密竹僧酸烟超苏蛋隔商排堂盘皇圆争偏顾狗尔鸡脱湘撞工结帝篇犯挺波告罗软千纸试然梦松辽旗绿痛准乐志失害陪啥致基躲证确逼丁政烤舰炮社钟咬糖劝宜腰杩箭灭侧寻躺襄角恩哦跪遇澶谷猛印异粮拖韩查嘛灯抗店伸阳阵兄帐编智沿操载暗灵百遭移郭砍养胡般呼托宗衣仗艘盛补幺吾笔费柄瓦败弟拱岭毕床洗止饮牌爹劲碗魔爷君孔恶洲奖术涔棣哼夺猪搭扶脉赵联佛虫穴莫价造登增鸟戏歌绕毁蒙屾切防尖踢父卡塔弱雕羊肯母脑视枚挡婚滑沙雄吐扎输闯许福捧案顺塞闪震迁课尾挖混累夹灰袁搬扯丢独跨曲施陵秋浅参授糕斜秦挑擦瞎亭扇露注镑尼护临丝屼温识醒演赛抽氨屋旨创例番跃校料牙廊透滚蓝亩舞审旅配薄摇怔杯富荆狼音鼓珠袭附慢睁圈废愈容颁嘉思赤拔征蜀顿尤佸粗俺丹严吉偷寄氏叔鲜歇锅吸煤辆闭钢刻浣划俩认妖缺谢煎脊吻尸柳税聚豆哈妃赢堆额轿抵俘芙静限鸿监积摔棒针蛇士唉伏避赏呵佳朕岩役沉阁埋捉探沟垂纯赐斩钻猜幅终票粉泡继沪欧掷徐休样彩嫁壁阴穷俱矿砸备胸矣递庆品扔握煮挤峰拥谱璇讨涌货议嗯抹亡喂影执盗统灏筑冰撤忠曹碎纲娶杂跌尊拨妙遍拳陆徒搜忍助炸傻减捕磨渡涨程窝测抛壳律库规租奥梁速患嫩互罚剅兽济缘档湿湾弯馆缩烈巨寒魏驾甜采刷己谋历景颗邪郎盯砖孤标泪牵锦纳膜展津突阔付净雷饿邻敲倾鞭绘扩岸扫杖迟拟担怀园威趁猫私稳撒慌贾肩轰珊颈伊榜碰浓哄农祝勇赚葬悬孝纹疼誉洪剩零坤录臭割棺缓瘦摩勒鹿踏瓶童宁遣免娃忧麻径尿筋剧译柱骗鼻永拆碑狂溜肥疏棉瞪疾辞胪整禁醉翁潜险瀹碳峡阻财固琴川肝误铅仪策嫌堤寰勾荷愣灌盼润臂捏维姑乌颤秀埃凶消述瑜爸液态扬槽饶缁挨翅锌钉卫察窗潮娥款哨鸭辟洋辨隐唤妻柴恐凉季阙刑闲剂摄典狠庸贺迷泉惹坡腹剪伯资鲁爆庄掩祖饱墩隆沔炉亏蹇鞋壮席珞柔伴欠镜召拐戒仇瞒砌乾郑莲充朗垱卵订饼雾衔瞅缠息璧燕码胖晋帖磁晃幕押熊扣健冠飘锁烂委索桃钩劈堡粑冬优扁舍滴缝喀野督晒檐蒸丑梅禀井胃希抖擒朵枝麦淡吊涂访抚诺杆截弃稀坑稿夷庵惧奴俗婶鳞裁困裂俊削咋敬撑暂催肾碧肺籍乎叉添凑拾浮怨窑壶残抄兰祀虾犹囊叙裹轴绑寮磷披返填赋粘沈揪敏阶扭普蕲症携嶅赞允务哟斋茎辈溪彼候滩瀛判杈逆炕掘舱袍陷氧搂绮刮泰汪钦趋评淑矮淮晕猴姐濂疯廷伙尝兑焦宣翼爪蹲戳耐池劫哎舌岱杭启册垮窄导喷友崖邀蜂腾欢鸣丘皱奶齿歪卞蔡砰厮罩侯锡拒墨革激踩贤熬汇姆什菌兆筒嗤捣闷烦胆玄酶巧习牢谓湴荣釜灞驴苗魂良谜侍驰妇荡赖肌掠耍岳箱拌堵繁浆汝辩腔侵祸仰竖珍豪染棋摘棍旋撰愁恭伐签链仁惨惯眉闸浪漆娟肚坟拦蛮遗赦羽覆屡坚责叩陀丽疑拽钙粒璁焖捡嚷仆织扒泛际技竞舵桂域卿窜缚粥苕郢吞梨倚禾劳耶拼甩序炼鞑服卦悟翠咽续盒控揭兜崇苯赌吼康褰挣鳙侨航予盆伞睿洛梢训漏绳隋娜姜肿菲雅卧鹰铸袋模吵哇珂灾荒誓医丈潵舆辅诰援坊彭洒斑宸刃兀袖雌硅枯辣烫妾沾泄剥弓损擅蒋秘匹丧氢揉详凿垫购捐盏肠萨戟磕勿虏否董窟唯恼锰侄跺欺尘鼎简艺逢究舟姝偶笛恰侠扮奕渝碱宴仓束逐惟串呜捞伦泊示砂桌剌觅脏黔鳌拚嫣挽妹卸灶乙浩娌铲谕驼浼斧搁艇触饰屏笼瑕嵌畔倘胶莱鹤吕渠傅佣逛迫醇冻迈奸滃泼伪镖坝熙瑰粤凤晴叠霍撕虹膝豫佹坦棱裘宅龟憋铝芯丐斡痰丛午潭脾钠薇萧撮沐遮唇昭锋荫孟羞酥钛旺幸循寸瓜恕贱塘煨材凝贪椒夸貌枕禅尺宿溶拂赔驱振敕蓉嗣搅丸芳镍扛摊途幼谏谨骞霜汞频销狱闽坪咀延昏鼠掏析范烘诛漫裙栽眨烩鲢享攀胎账贝滨杜牧乳冤喘浑敝韦啪衰妥焉棵释聊寿甘奈屯咦暮宠筹遵汁邓剁噢娑伽瑙锜衫霸卜效姹佐拣巡盟糟咳纪乞嫂涉窖键缸售圭蟹荤卢符肃宰悲渔帅藻宏箢椅株藉纱徙菊丰贫贷吏嚼秃辇弗卤冈揖械喇博桑构昆逾陡棚鸠堪企瑞适拢匾韵滇惠豹嵋瓷促绉醋帽彦耙膳狮桩诚剿旱歼钞艳逸畅贯狭埌暴颊森嘻捷瀵悔炎姥罐斤栏陶羹龢硫璺铀匠搴鳄簿幽浙胀唬警薪佑楞塌茅桶捆悉罕婆申阅彬黎裕葱龄梯螺捎皖摹杉澧藩预鹅哗挟铮赣酱诀锥哀琳涘堕蒿夔辱俞碟曼挪慈芝篮栖怡厄窃兔驿饵贡莎煌呛榻哉澳薛盾耕拴脂勤巢择坠氮钾帕咧腻研枉诲祐粪柜啃娉雇邑芒屁债滋胈艾馔凹敷畜寓扳鞘育脆虑颠娇饲锤检杰涅枢冯丞搓绢泽磅卑殷趟辑拧镶巾哑播腊绾庶映獾祥轩痒爽署捅嚭餐匪赠乖叛陕澄癌挎隶胁澹濮逻怯瘤刨咏仿眠吟蕃儒溅牡畏危邢檀恒芥浇默蒲猎禹耗捻颂忒崔喉柬乍斟趾犬懒铃棰炯蛛钧昂屈藤币晶协鹏镁煞赫斌枭嗐茨祠焚融琛睦乔璋胤虞钴巷遥迹纬爵苔梗讳潘铬腑慧燃褪滆鳔郧浸谦耸兮殊宾糊鉴凸槎刊娴饷辛佺嗔植甫骇顽猿旷逍呸扰拎庑揽厌弊捶笃玛蓬羌肖鳍宇詹址恢濡喵辫甯俯函碘狐逮靖聘谭鞍甭翘伍绗恋佩瓮帆氖剃蝉鲤揣腐瞥庭洺庇弧坎契梭掀拈勋韬叮碾踅痴茬崩姘惜漩烛札茸屎婴珰阜愬撬婢纺妄淫驮碍犁亨桨苑绞弥缅挠鲨尹锺轨媒妮腮哲益愚镐鹃帘毅颖辉郊毙懿兹券僵晓毡渴捋纨箍篆蚌窦氯裤顷蹦盔雀礁熏仔棘昌诉冢辰愤嗜矛梳匣芽桓蹬蜡鳃逝腺笨舒肆蛙贬橙娲攒笙傜揩缴麽氟於杞鳖嘿溃涛违佽蛟敛凛储寡绛蒜蹿灼泻姚啄唔俸芜蚁腕捂靛廉淋殖矗幢稻栎酮络儴掣谐棂隅瓣瑶斥掐贩玫琼隙搏迭裸熔蒂暨滥掳厢仕惺缎沽眯昔磴勘努嗅晨蛾抑诵啷踱庞疆撇瞻谅冥腌萼褐胞淘咒梓慰棕钒馋撩枣肢滞噗绷颜蟾逊痕咸验绐矢螭挫妓彪绍绽椎窥赎介寝酯酬概硕堰朔冶垒膛钨杏淇灸呐肘钡诘括蜜厘驳砥鲸诈胯菱咯寇慎孕妆亸吱逗桦幌漂阮匀狄谟驶椁勃蹄氐褂践腥蓄贞戣蹭钓诱肋窍颐凳悄雁靶葛污霞椋酷冀蚀渊壕幻荐渣叱蛔咪卓傍乏毫嘶衙劻嘎夕徽枷淤迸穆屑嗳禄盲纤耀彧瑛邮谌厨磋戎臀怠躬伟愭塑膏迥锣淌疲穗逞簇迪娆佃裴钵橱霉描祎抿慕盈汊锯貂忿姣廖淖渗踪墟墦谥募饥弩蚕旦涟俏玮彝峨钯麝估姬昧纽燥璘斐奋谎舅舜萱玻谒褚撵炭芸矾茂楹榨蘸戈凌偕搀杵嗨澜毗锐衷衬况浴佬瞄箫昙凯诊楂谝孳椤恃箕舂犺魁绊洁恳柑绵胚螅胺氦鹊贮坞蹙倭愧晏嬬靴欣笺镂丙骸迦劣膨馍熜袄漕啸怜垎倦漠姨迳骡泣勺舔钝浦巳浊棤秩骤渚赍轧抡堑偿曙樱珪戚邺镞邸稽禽攥绸荃缀嗟绔辏苍愕沁汀珮瞟筛蛹沅熻霓濒秤讹蟒锭葡拭筵恍涧涵僻歉蝇夥谛鲍惶锏尉蠢矶铭搔莺隘襟览烙璐崄蟮嗒涩釉脖喏绒衡眷绫吁恁钊纷茧侮宵溴苻柏履绠彻幡袱阖趣溯砚芬裔姿跋苟匈泵锄甸纠缰庐阎榷恪匡撂茫踹抠础贰琚碌尧悖秉铂憨峻瑟驷暇撅铿殉拄妗帧淳窒玹琅粟帻汴邬樊框疗囚峙孰喻俟崚龅鄙叭钼飚哒皓螨脓耻拘锑蚊苞郝疮簧镏馐栋熄俅肽咚攸厥拇趴喽帛睛呕垚悦槌陛轶岘嗛圃樵髓宪溢皂癸鞯惰麓央嘱邱掖竿柯麒醛翂猇峣朋峁芰敞遁佚椹绌牒晌唆鲌隨啰绱绯炬壤厦翔焰仲洄滤稷珈矫垣喙槐厉晾聋魄浃楠嗽棠嘤饔鲛掰苛朴衍涞晦吭觑瞬讼雍障龋霏唷吠珩媚谑瘾涢鲩嫡淹舀颍岔浚拗庤耽硼啼俑炖垦箐晁氽蝶竭靡拓榭郃黛培倡糠陇瘫愉垛橹骆孽磐剖综婊迄呗夐敦夯蝗摺沫巫酣缮炙孛洿苷睬秽咕鸾扼栅瘀鳎伶萝琐瓒谩钳柿娓絮鸦稠梵榛渎鬓拙宦蕉缇嚎衢宛诬嘘忆骄彰啐萍帜浐纭缙侗妫苫糯髯砷喧悍缉钗栗缕擢椿嫉瑧沸髦渤盅艿鹄惩剐巍讪酚搠隼噶佟屠玺阉讫倪绻刹娣虻烃毋旭询庋斓嗦丫樟褶琉揍皎贸锚缂掂纣伎俾龛铣饬嚬肤拷躯嗡楝稚蝎镉茗牟嗬蔽枫侦圜岬攘昨竦辂锂聪叨淞呷鼐炳叼孩臻盎傲豢髻赡昇肇渥谶筷蔓闵噙蛊豁寂慑绥帷恤躁诞焕筐嗖宥缃掺措烹涡噎葑飧旬濞瑁羯刂筏删纂弁畲疤擂纰噬腋缱蛭迤炰宕妞莽渭氾驯筝晫檄蓟翰睢湍榆奚蕨孜哧雒圩倏劾炊摧埂匝泾酉闺怂翟蹚跛垢沮饕讷诃膊亥卯绦傣哂庖妒懦琢撸瞿窘蔷跷骚婉薰赈雉戮铏阀濠隽镰懵璞峪濊炽鸽奢佯铡绰掸闳诫澡彀斫笈魅煽缒槃熵珅罡矩盂绁袷阊惑硝婿匙酿羡衅塬衮郅埠徊茄恸迅亍趸咎镗伺诡溺篷瓢诳锻铐幔嵩亟恚柩邵酰妍胰郁谊昼矜绺焙僚擎黍沼酌墒壑笠驭呴槛葵捺泗狻桐颌辍沓颅烷龚辔壬唰偃僮咄枰漳剜戍廓冉滕沃曳蕴嘭渌鹗沧锢跤桅黼哺涎锈绪屿匦虼呃巩臼踞蟆洓赟焊蚧啤蕊舷氲硌撼榴谬曦懈栈冮啾魑涣瘸潞畹謇鹫琏莆敖洹颏涝痢汽谴韧硒炫夭濉藓馅篡磺酋蜕唾炆痣纾觥鹪灿钤芷獐弘萌嫖诠吮蔚戊赘梾欤铎捱莉玲陌耆馨憎咨偈旌烯轭幙驹俪闩杠斛殴闰袜岣沏秆嚓艰虱栓吆埆岫帙炷笆巅骏罄笋嗵鼋痘奎糜峭蛆圪锗睹凄祈虔锹刈厍寤涑潟畴毯荼呦瑗濋绲铳黏奠贿闾橐洼挚偎沂町缨舐虐膻嘀绋胄鱿瑷祷诓漓鍪咔祺垓孢鄀搽荚垄傕嬖岢鸩曚淼丕崧渍孵痈詈宓蟠珀蜥籽囷埽杓诧哆蛤晖蕾毓巽谀饩绅坍惭亢沦泌眩鲇瞳叵咝浉钽厕恻桔恺芦暑鑫啵椟硷绩狡励鞣疣臧卮槭煲爿咭崂侣坯骈渲俣硎缌罅胫钍颉痹镀怼醚勉嬉噪姤讵閰牲谡佥慊搦缡蠹馀讥俨咂娼庚爰禛铌铰龇卣柊诤淬蹈蛀媳笞闇碉沣眶蚂寐臊犀娈畿祧鲈婷陨螯嘟阑瀑姞漱裨镦辐耿洌嫔弑燧剔瘟泳仡诩鲧歧痔箸铩镫淝筜蚴诜粲囤婕橘缆茉褥朽叆徭楗癖茜莹踊簪甑蛩鄄肛缟凰乒抒鸵苇鲎飨涯魇硪钚褒菇膺悠倞兖珛鄣鋈鸬颚彷哐馈陋祛疫榄擀睾掼俭倔摞蹋蚜凇嗷煳稹镌馕蔼涤艮倩榫猬帚乩坨畬缢腭谄铋锆锶喔砾髡嘈淀娄烻诙镣雠瘪乓擞狲獭栉汲阐犊沛寅仄绂弼淙铠殓檬涮煜嘣桡砺芟谙匆镬髁匿洽亵囿岷窠鞠鸥昕匕虢镠龃弛缈脐媛钥氩郪悼肪憾瑾崃镭鳗聂痊颓忤谯锾搧噹遏辜咣珑哝谣铢悆蓼诟铍鲂婀膀叽嗄诨谖龀怵贻姻邹刁卟橇苁蛏谗迨鲆跫皋蝌霾衾艄罔涿谠酢醮庀忖汾兢漾嵁幂湜玠笮绀饺遽沥翎遛薯肴梴焐犍芋醯锨蔪璟傩椭晤掾呶垭妤箩纛诖诮熲盹苹愠梆殁鼍洩痉楷砻噜蜷烁荀噫棬蠓龉侃疃俚痪秸艽蹼郓钪雏噔掇妨慷滦耄渺滂旃赀牴摁篙犒麟聆堋奁胱觯椽锉玖飕豚鹞壅甄鬃岐徵缬郏酆阇羁蔫穑骰曜恣嘁彘掞螫踔闫芭舶裆牍珲沤穹蜃沱尕昉瘛硐祆翱藜阈黾婵歹鲫犟畦猩娱崽倌榧獬碛舛讽孀梧鳕恿辕瘴叟嗝姒悴惇掬甾笱胍甙郴诽涸骊琦龆饨挝蚤揿浔闿鞫鹘嘲粱萘睨侬茵钺疹圉暲楔湟砆笫羟诔谔铱鼬併氛菏馄琵嚣蔗嫭嶂汛笥缗芊荩邯燎胧缪绶惴獠玎瘢肟鞒鲑踝桀厩泯蔬忝彤辄唑";

  /** 内置 1378 高频字标准笔画走向序列（H横 V竖 S撇 D捺/点 Z横折 L竖折） */
  var BUILTIN_STROKE_SEQ = {"一":"H","乙":"Z","九":"SZ","七":"DL","十":"HV","人":"SD","丁":"HV","刀":"ZV","二":"HH","入":"SD","八":"SD","又":"ZD","了":"ZV","力":"ZV","下":"HVD","干":"HHV","丸":"VHD","久":"SZD","及":"VZD","弓":"ZHV","己":"ZHL","口":"VZH","工":"HVH","才":"HVS","三":"HHH","山":"VLV","士":"HVH","子":"ZVH","勺":"SZD","女":"LSH","小":"VSD","上":"VHH","丈":"HVD","刃":"ZVD","寸":"HVD","千":"SHV","川":"VVV","大":"HSD","土":"HVH","亡":"VHL","凡":"VHD","万":"HZV","也":"ZVL","夕":"SZD","与":"HVH","井":"HHVV","引":"ZHLV","云":"DHLD","王":"HHVH","化":"SVSL","火":"DSVD","介":"SDVV","牛":"SHHV","凶":"SDLV","斤":"SVHV","区":"HSDL","欠":"SZVD","月":"VZHH","犬":"HVDD","元":"HHVL","幻":"LLDZ","五":"HVZH","午":"SHHV","公":"SDLD","孔":"ZVDL","号":"VZHHL","今":"SDHZ","支":"HVZD","止":"VHVH","氏":"SVHL","尺":"ZHVD","手":"SHHV","升":"SVHV","少":"VSDS","冗":"VZVH","心":"SLDD","仁":"SVHH","水":"VZSD","切":"HLHV","双":"HDHL","太":"HSDD","丹":"VZDH","中":"VZHV","天":"HHSD","斗":"DDHV","屯":"SLVL","内":"VZVD","日":"VZHH","反":"HVZD","匹":"HVLL","不":"HSVD","夫":"HHSD","父":"SDVD","分":"SDZS","文":"DHVD","片":"VVHZ","方":"VHZV","乏":"SVZD","毛":"SHHL","木":"HVSD","厄":"HVZL","友":"HSZD","予":"ZDZV","六":"DHSD","比":"SLSL","以":"VDVD","右":"VHVZH","永":"DZZSD","凹":"ZVHLV","央":"VZHVD","加":"ZVVZH","可":"HVVZH","外":"SZDVD","且":"VZHHH","刊":"HHVVV","甘":"HVVHH","丘":"SVHVH","旧":"VVZHH","去":"HVHLD","巨":"VHZHH","玉":"HVHHD","句":"SZVZH","兄":"VZHVL","穴":"VVZSD","玄":"VHLLD","古":"HVVZH","功":"HVDZV","巧":"HVDHV","甲":"VZHHV","左":"HVHVH","札":"HVSDL","皿":"VZVVH","仕":"SVHVH","司":"ZHVZH","史":"VZHVD","四":"VZSLH","市":"VHVZV","示":"HHVSD","叱":"VZHSL","失":"SHHVD","写":"SZHLH","主":"DHVHH","囚":"VZVDH","汁":"DDDHV","出":"VLVLV","召":"ZVVZH","申":"VZHHV","世":"HVVHL","正":"HVHVH","生":"SHHVH","斥":"SVHVD","石":"HVVZH","仙":"SVVLV","占":"VHVZH","他":"SVZVL","打":"HVDHV","代":"SVHLD","台":"LDVZH","田":"VZVHH","奴":"LVHHD","冬":"SZDDD","凸":"HVZLV","尼":"ZHVSL","白":"SVZHH","半":"DSHHV","犯":"SDSZL","皮":"VZVZD","必":"DSSLD","付":"SVHVD","布":"VHVZV","丙":"HVZVD","平":"HDSHV","母":"LZDDH","包":"SZZHL","北":"HVDSL","本":"HVSDH","末":"HHVSD","未":"HHVSD","民":"ZHVHL","矛":"ZDZVS","目":"VZHHH","矢":"SHHVD","由":"VZVHH","幼":"LLDHV","用":"VZHHV","立":"VHDSH","令":"SDHZV","礼":"VZVDL","名":"SZDVZH","安":"VVZLVH","衣":"DHSHSD","芋":"HVVHHV","印":"SVHHZV","因":"VZHVDH","宇":"VVZHHV","羽":"ZDDZDD","臼":"SVZHHH","会":"SDHHLD","回":"VZVZHH","灰":"HVVSVD","各":"SZDVZH","汗":"DDDHHV","缶":"SHHVLV","企":"SDVHVH","危":"SZHVZL","机":"HVSDVH","吉":"HVHVZH","休":"SVHVSD","吸":"VZHSZD","朽":"HVSDHV","共":"HVVHSD","叫":"VZHLV","仰":"SVSVZV","曲":"VZVVHH","刑":"HHVVVV","血":"SVZVVH","件":"SVSHHV","交":"VHSDSD","光":"VDSHVL","向":"SVZVZH","后":"SVHVZH","好":"LSHZVH","孝":"HVHSZH","江":"DDDHVH","考":"HVHSSL","行":"SSVHHV","合":"SDHVZH","再":"HVZHHV","在":"HSVHVH","旨":"SLVZHH","死":"HSZDSL","至":"HLDHVH","字":"DSZZVH","寺":"HVHHVD","次":"DDSZVL","而":"HSVZVV","耳":"HVHHDV","自":"SVZHHH","式":"HHVDLD","芝":"HVVVZD","守":"VVZHVD","朱":"SHHVSD","州":"SVDVDV","舟":"SVZDVH","充":"VHLDVL","旬":"SZVZHH","巡":"LLLDZD","匠":"HSVHVL","庄":"VHVHVH","色":"SZZVHL","尽":"ZHVDDD","迅":"HHVDZD","成":"VHZLSD","西":"HVZVLH","舌":"SHVVZH","先":"SHVHVL","全":"SDHVHH","壮":"VDDHVH","早":"VZHHHV","争":"SZZHHV","存":"HVVZVH","多":"SZDSZD","宅":"VVZSHL","地":"HVDZVL","池":"DDDZVL","竹":"SHVSHV","仲":"SVVZHV","虫":"VZHVDD","兆":"VDDLSD","吐":"VZHHVH","灯":"VDVDHV","当":"VDSZHH","同":"VZHVZH","肉":"VZVDSD","如":"LVHVZH","任":"SVSHVH","年":"SHHVHV","肌":"VZHHVH","伐":"SVHDSD","帆":"VZVVHD","百":"HSVZHH","伏":"SVHVDD","米":"DSHVSD","忙":"SDVDHL","朴":"HVSDVD","亦":"VHVVSD","妄":"VHLLVH","有":"HSVHHH","羊":"DSHHHV","吏":"HVZHVD","列":"HVZDVV","劣":"VSDSZV","亘":"HVZHHH","位":"SVDHDSH","医":"HSHHSDL","何":"SVHVVZH","花":"HVVSVSL","我":"SHVHDSD","快":"VSDZHVD","戒":"HHVVLSD","改":"ZHLSHVL","角":"SZVZVHH","完":"VVZHHVL","肝":"VZHHHHV","含":"SDHZVZH","希":"SDSHVZV","忌":"ZHLSLDD","汽":"DDDSHHH","技":"HVDHVZD","却":"HVHLDZV","求":"HVDDSDD","究":"VVZVLVH","狂":"SVSHVHH","局":"ZHVZVZH","均":"HVDVZDD","近":"SVHVDZD","吟":"VZHSDHZ","君":"ZHHVVZH","形":"HHVVSSS","系":"SLLDVSD","芸":"HVVHHLD","迎":"SVZVDZH","言":"DHHHVZH","坑":"HVDVHVH","宏":"VVZHVLD","抗":"HVDVHVH","攻":"HVDSHVL","更":"HVZHHVD","克":"HVVZHVL","告":"SHVHVZH","困":"VZHVSDH","佐":"SVHVHVH","材":"HVSDHVS","作":"SVSHVHH","伺":"SVZHVZH","志":"HVHSDDD","私":"SHVSDLD","似":"SVVDDVD","社":"VZVDHVH","寿":"HHHVHVD","秀":"SHVSDVZ","住":"SVDHHVH","初":"VZVSDZS","助":"VZHHDZV","序":"VHVZDZV","床":"DHVHVSD","抄":"HVDVSDS","肖":"VSDVZHH","条":"SZDHVSD","状":"VDDHVDD","伸":"SVVZHHV","臣":"VHVZHVH","身":"SVZHHDS","辛":"VHDSHHV","吹":"VZHSZVL","杉":"HVSDSSS","声":"HVHZVHV","赤":"HVHVVSD","折":"HVDSVHV","走":"HVHVHSD","即":"ZHHVDZV","束":"HVZHVSD","足":"VZHVHVD","村":"HVSDHVD","妥":"SDDSLVH","体":"SVHVSDH","但":"SVVZHHH","谷":"SDSDVZH","男":"VZHVHZS","沈":"DDDVZVL","低":"SVSVHLH","呈":"VZHHVHH","廷":"SHVHZZD","弟":"DSZHLVS","努":"LSHZDZV","投":"HVDVHZD","豆":"HVZHDSH","那":"HHHVZV","尿":"ZHVVZSD","妊":"LVHSHVH","忍":"ZVDSLDD","把":"HVDZVHL","伯":"SVSVZHH","麦":"HVHHSZD","伴":"SVDSHHV","判":"DSHHVVV","否":"HSVDVZH","批":"HVDHVSL","肥":"VZHHZVL","尾":"ZHVSHHL","扶":"HVDHHVD","兵":"SVHVHSD","返":"HVZDDZD","甫":"HVZHHVD","芳":"HVVVHZV","邦":"HHHVZDV","坊":"HVDVHZV","妨":"LVHVHZV","忘":"VHLVLDD","防":"ZDVVHZV","没":"DDDVZZD","迄":"SHHDDZD","妙":"LVHVSDS","役":"SSVVHZD","余":"SDHHVSD","抑":"HVDSVZV","来":"HDSHVSD","乱":"SHVVZHL","卵":"SVDVZVD","利":"SHVSDVV","里":"VZHHHVH","良":"VZHHVSD","冷":"DDSDDZD","励":"HVHZVZV","肛":"VZHHHVH","岑":"VLVSDHZ","宛":"VVZSZDZL","依":"SVVHSVSL","委":"SHVSDLVH","易":"VZHHSZSS","育":"VHLDVZHH","雨":"HVZVDDDD","泳":"DDDDZZSD","英":"HVSVZHVD","延":"SVHVHZZD","沿":"DDDSDVZH","炎":"DSVDDSVD","苑":"HVVVZDZL","往":"SSVDHVHH","押":"HVDVZHHV","欧":"HVDLSZVD","殴":"HVDLVLZD","佳":"SVHVHHVH","果":"VZHHHVSD","河":"DDDHVVZH","画":"HVZHVHLV","芽":"HVVHVHVS","怪":"SDVZDHVH","拐":"HVDVZHZV","学":"DVSVZZVH","岳":"SVHVHVLV","官":"VVZVZHZH","岸":"VLVHVHHV","岩":"VLVHVVZH","奇":"HVDHVVZH","祈":"VZVDSVHV","季":"SHVSDZVH","宜":"VVZVZHHH","泣":"DDDVHDSH","居":"ZHVHVVZH","拒":"HVDVHZHH","享":"VHVZHZVD","京":"DHVZHVSD","供":"SVHVVHSD","峡":"VLVHDSVD","金":"SDHHVDSH","苦":"HVVHVVZH","具":"VZHHHHSD","空":"VVZVLHVH","屈":"ZHVVLVLV","径":"SSVZDHVH","茎":"HVVZDHVH","券":"DSHHVDZV","肩":"HZHVVZHH","弦":"ZHLVHLLD","呼":"VZHSDSHV","固":"VZHVVZHH","虎":"VHVZHLVL","幸":"HVHDSHHV","拘":"HVDSZVZH","昂":"VZHHSVZV","肯":"VHVHVZHH","刻":"DHLSSDVV","国":"VZHHVHDH","妻":"HZHHVLVH","刷":"ZHVVZVVV","参":"LDHVDSSS","使":"SVHVZHVD","刺":"HVZVSDVV","枝":"HVSDHVHL","肢":"VZHHHVZD","事":"HVZHZHHV","侍":"SVHVHHVD","治":"DDDLDVZH","者":"HVHSVZHH","邪":"HVHVSZDV","若":"HVVVHVZH","取":"HVHHDVZD","受":"SDDSVZZD","周":"VZHVHVZH","宗":"VVZHHVSD","叔":"VHHVSDHL","述":"HVSDDDZD","所":"SVZHSVHV","尚":"VDSVZVZH","承":"ZVHHHZSD","招":"HVDZVVZH","松":"HVSDSDLD","沼":"DDDZVVZH","垂":"SHHVVHVH","炊":"DSVDSZVD","枢":"HVSDHSDL","制":"SHHVZVVV","姓":"LSHSHHVH","征":"SSVHVHVH","性":"SDVSHVHH","青":"HVHHVZHH","昔":"HVVHVZHH","析":"HVSDSVHV","拙":"HVDVLVLV","阻":"ZDVVZHHH","卒":"VHSDSDHV","卓":"VHVZHHHV","拓":"HVDHVVZH","担":"HVDVZHHH","知":"SHHVDVZH","宙":"VVZVZVHH","忠":"VZHVSLDD","抽":"HVDVZVHH","注":"DDDDHVHH","直":"HVVZHHHL","坪":"HVDHDSHV","定":"VVZHVHVD","底":"VHVSVHDH","抵":"HVDSVHDH","邸":"SVHDHZDV","泥":"DDDZHVSL","的":"SVZHHSZD","迭":"SHHVDDZD","典":"VZHVVHSD","店":"DHSVHVZH","到":"HLDHVDVV","毒":"HVHHLZVH","突":"VVZVLHVL","届":"ZHVVZVHH","乳":"SDDSZVDL","念":"SDDZSLDD","波":"DHDZVVZD","杯":"HVSDHSVD","拍":"HVDSVZHH","泊":"DDDSVZHH","迫":"SVZHHDZD","板":"HVSDHVHL","版":"VVHZHVZD","彼":"SSVVZVZD","披":"HVDVZVZD","泌":"DDDDVLDD","非":"VHHDVHHH","表":"HHVHSVSD","苗":"HVVVZVHH","府":"VHVSVHVD","怖":"SDVSHVZV","附":"ZDVSVHVD","侮":"SVSHLZVH","武":"HHVHVDLD","服":"VZHHZVZD","沸":"DDDZHVVV","物":"SHVDSZSS","奉":"HHHVDHHV","宝":"VVZHVHHD","抱":"HVDSZZHL","放":"VHZVSHVL","法":"DDDHVHLD","泡":"DDDSZZHL","房":"HZHVVHZV","肪":"VZHHVHZV","牧":"SHVDSHVD","奔":"HVDHVHVV","妹":"LSHHHVSD","枚":"HVSDSHVL","抹":"HVDHHVSD","味":"VZHHHVSD","岬":"VLVVZHHV","命":"SDHVZHZV","明":"VZHHVZHH","免":"SZVZVHVL","茂":"HVVVHLSD","盲":"VHLVZHHH","夜":"VHSVSZDD","油":"DDDVZVHH","林":"HVSDHVSD","例":"SVHVZDVV","炉":"DSVDHZHV","和":"SHVSDVZH","迪":"VZVHHDZD","哀":"VHVZHSVSD","昆":"VZHHHVDSL","威":"VHHLSHLSD","胃":"VZVHHVZHH","姻":"LVHVZHVDH","映":"VZHHVZHVD","疫":"VHVDDVHZD","屋":"ZHVHLDHVH","卸":"SHHVHVDZV","音":"VHDSHVZHH","科":"SHVSDDDHV","架":"ZVVZHHVSD","悔":"SDVSHVZVH","海":"DDDSHLZHDD","界":"VZVHHSDVV","垣":"HVDHVZHHH","革":"HVVHVZHHV","括":"HVDSHVVZH","活":"DDDSHVVZH","冠":"VZHHVLHVD","看":"SHHSVZHHH","客":"DSZSZDVZH","虐":"VHVZHLHHL","逆":"DSHLVVDZD","急":"SZZHHSLDD","挟":"HVDHDSHVD","狭":"SVSHDSHVD","型":"HHVVVVHVH","契":"HVHDZVHVD","建":"ZHHHHVZZD","研":"HVVZHHHVV","限":"ZDVZHHVSD","孤":"ZVDSVVDDL","弧":"ZHVSVVDDL","故":"HVVZHSDVL","枯":"HVSDHVVZH","侯":"SVZHSHHVL","厚":"HVVZHHZVH","恒":"SDVHVZHHH","晃":"VZHHVDSVL","洪":"DDDHVVHSD","皇":"SVZHHHVHH","荒":"HVVVHLVVL","郊":"VHSDVDZDV","香":"SHVSDVZHH","拷":"HVDHVHSSV","恨":"SDVZHHVSD","砂":"HVVZHVSDS","削":"VDSVZHHVV","昨":"VZHHSHZHH","姿":"DDSZVDLVH","思":"VZVHHSLDD","指":"HVDSLVZHH","施":"VHVZSHZVL","持":"HVDHVHHVD","室":"DSZHLDHVH","狩":"SVSVVZHVD","首":"DSHSVZHHH","拾":"HVDSDHVZH","秋":"SHVSDDSVD","臭":"SVZHHHHVD","柔":"ZDZVSHVSD","重":"SHVZHHVHH","祝":"VZVDVZHVL","俊":"SVSDVLVHD","春":"HHHVDVZHH","盾":"SVHVVZHHH","叙":"SDHHVSDHD","昭":"VZHHZVVZH","省":"VSDSVZHHH","城":"HVDVHZDSD","食":"SDDZHHVSD","信":"SVDHHHVZH","侵":"SVZHHSZZD","神":"VZVDVZHHV","甚":"HVVHHHVLL","是":"VZHHHVHSD","政":"HVHVDSHVD","星":"VZHHSHVHH","牲":"SHVDSHVHH","窃":"VVZVLSLZV","宣":"VVZHVZHHH","泉":"SVZHHVZSD","浅":"DDDHHHLSD","洗":"DDDSHVHVL","染":"DDDVHHVSD","前":"DSHVZHHVV","祖":"VZVDVZHHH","奏":"HHHVDHHVD","相":"HVSDVZHHH","草":"HVVVZHHHV","送":"DSHHVDDZD","促":"SVVZHVHVL","俗":"SVSDSDVZH","耐":"HSVZVVHVD","待":"SSVHVHHVD","怠":"LDVZHSLDD","胎":"VZHHLDVZH","退":"ZHHVSDDZD","炭":"VZVHVDSVD","胆":"VZHHVZHHH","段":"SVHHHVHZD","茶":"HVSSDHVSD","昼":"ZHVDVZHHH","柱":"HVSDDHVHH","衷":"HVZHVSVSD","挑":"HVDVDDLSD","珍":"HVHDSDSSS","津":"DDDZHHHHV","追":"SVZHZHDZD","亭":"VHVZHVZHV","帝":"VHDSVZVZV","点":"VHVZHSDDD","度":"VHVHVVHZD","怒":"LVHZDSLDD","逃":"VDDLSDDZD","洞":"DDDVZHVZH","匿":"HHVVSVZHL","独":"SVSVZHVDD","南":"HSVZDSHHV","派":"DDDSVSVSD","背":"HVDSLVZHH","肺":"VZHHVHVZV","卑":"SVZVHHSHV","美":"DSHHVHHSD","秒":"SHVSDVSDS","品":"VZHVZHVZH","赴":"HVHVHSDVD","封":"HVHHVDHVD","粉":"DSVSDSDZV","柄":"HVSDHVZVD","便":"SVHVZHHVD","保":"SVVZHHVSD","胞":"VZHHSZZHL","某":"HVVHHHVSD","冒":"VZHHVZHHH","盆":"SDZSVZVVH","迷":"DSHVSDDZD","面":"HSVZVVHHH","柳":"HVSDSVVZV","勇":"ZDVZVHHZV","幽":"VLLDLLDLV","洋":"DDDDSHHHV","要":"HVZVVHHLV","浴":"DDDSDSDZH","律":"SSVZHHHHV","料":"DSVSDDDHV","厘":"HVVZHHVHH","玲":"HVHDSDHZV","郎":"VZHHVDZDV","洵":"DDDSZVZHH","皆":"HVDSLSVZHH","案":"VVZLVHHVSD","院":"ZVDSZHHSL","浦":"DDDHVZHHVD","益":"DSHSDVZVVH","悦":"SDVDSVZHVL","宴":"VVZVZHHLVH","翁":"SDLDZDDZDD","俺":"SVHVDVZHHL","恩":"VZHVDHSLDD","夏":"HSVZHHHSZD","家":"DSZHSDSSSD","荷":"HDSSVHVZHV","蚊":"VZHVDDVHVL","害":"VVZHVHHVZH","格":"HVSDSZDVZH","核":"HVSDVHLSSD","株":"HVSDSHHVSD","既":"ZHHVDHVHVL","起":"HVHVHSDZHL","鬼":"SVZVHHVLLD","恐":"HVDVHDSLDD","恭":"HVVHSDVSDD","胸":"VZHHSZSDLV","栗":"HVZVVHHVSD","桑":"ZDZDZDHVSD","郡":"ZHHVVZHZDV","兼":"DSHZHHVVSD","原":"HVSVZHHVSD","悟":"SDVHVZHVZH","候":"SVVZHSHHSD","校":"HVSDVHSDVL","耕":"HHHVSDHHVV","航":"SVZDVDVHVH","降":"ZDVSZDHVHV","高":"DHVZHVZVZH","骨":"VZVHVZVZHH","根":"HVSDZHHVSD","唆":"VZHLDSLSZD","差":"DSHHHSHVH","座":"DHVSDSDHVH","宰":"VVZVHDSHHV","栽":"HVHHVSDLSD","索":"HVVZLLDVSD","蚕":"HHVDVZHVHD","残":"HVHDHHHDSD","脂":"VZHHSLVZHH","疾":"VHVDDSHHVD","射":"SVZHHDDHVD","借":"SVHVVHVZHH","酌":"HVZVLHHSZD","弱":"ZHVDDZHVDD","殊":"HVHDSHHVSD","珠":"HVHDSHHVSD","酒":"DDDHVZVLHH","修":"SVVSHSDSSS","准":"DDSVSHVHHH","殉":"HVHDSZVZHH","徐":"SSVSDHHVSD","除":"ZDVSDHHVSD","宵":"VVZVDSVZHH","将":"VDDSDDSHVD","消":"DDDVDSVZHH","症":"VHVDDHVHVH","祥":"VZVDDSHVHH","称":"SHVSDSHVSD","笑":"SHVSHVSHVD","辱":"HVHHVSDHVD","唇":"HVHHVSDVZH","娠":"LVHHVHHVSD","振":"HVDHVHHVSD","晋":"HVVDSHVZHH","浸":"DDDZHHVZZD","真":"HSVZHHHHSD","衰":"VHVZHHSVSD","逝":"HVDSVHVDZD","席":"VHVHVVHVZV","扇":"HZHVZDDZDD","栓":"HVSDSDHVHH","租":"SHVSDVZHHH","素":"HVHHLLDVSD","造":"SHVHVZHDZD","息":"SVZHHHSLDD","速":"HVZHVSDDZD","袖":"VZVSDVZVHH","泰":"HHHVDVDDSD","致":"HLDHVDSHVL","畜":"VHLLDVZVHH","逐":"HSDSSSDDZD","秩":"SHVSDSHHVD","通":"ZDVZHHVDZD","庭":"VHVSHVHZZD","哲":"HVDSVHVVZH","展":"ZHVHVVHVSD","徒":"SSVHVHVHSD","途":"SDHHVSDDZD","倒":"SVHLDHVDVV","党":"VDSVZVZHVL","唐":"VHVZHHVVZH","桃":"HVSDVDDLSD","透":"SHVSDSZDZD","特":"SHVDHVHHVD","能":"LDVZHHSLSL","破":"HVVZHVZVZD","俳":"SVVHHHVHHH","配":"HVZVLHHZHL","倍":"SVVHDSHVZH","梅":"HVSDSHLZVH","班":"HHVDVVHHVH","畔":"VZVHHDSHHV","般":"SVZDVDVHZD","疲":"VHVDDVZVZD","秘":"SHVSDDSLVD","被":"VZVSDVZVZD","病":"VHVDDHVZVD","浜":"DDDSVHVHSD","敏":"SHLZVHSHVL","瓶":"DSHHVVHVZD","浮":"DDDSDDSZVH","勉":"SZVZVHVLZV","捕":"HVDHVZHHVD","俸":"SVHHHVDHHV","峰":"VLVSZDHHHV","剖":"VHDSHVZHVV","埋":"HVDVZHHVHH","眠":"VZHHHZHVHD","娘":"LVHVZHHVSD","耗":"HHHVSDSHHL","容":"VVZSDSDVZH","流":"DDDVHLDVVL","留":"SVDZSVZHVH","旅":"VHZVSHSVSD","烈":"HSZDVVSDDD","恋":"VHVVSDSLDD","朗":"VZHHVDVZHH","浪":"DDDVZHHVSD","陛":"ZDVHVDSLHVH","梓":"HVSDVHDSHHV","尉":"ZHVHHVSDHVD","移":"SHVSDSZDSZD","域":"HVDHVZHDDSD","逸":"SZVZVHVLDZD","液":"DDDVHSVSZDD","黄":"HVVHVZHVHSD","械":"HVSDHHVVLVD","涯":"DDDHVHVHHVH","郭":"VHVZHZVDZDV","喝":"VZHVZHHDHDSL","乾":"HVVZHHHVSHZ","勘":"HVVHHHVLLZV","患":"VZHVZHVSLDD","眼":"VZHHHZHHVSD","基":"HVVHHHSDHVH","寄":"VVZHVDHVZHV","菊":"HVVSZDSHVSD","脚":"VZHHHVHLDZV","救":"HVDDSDDSHSD","球":"HVHDHVDDSDD","虚":"VHVZHLVVDSH","教":"HVHSZVHSHVD","菌":"HVVVZSHVSDH","偶":"SVVZHHVZVHD","掘":"HVDZHVHLVLV","健":"SVZHHHHVZZD","康":"VHVZHHVDDSD","控":"HVDVVZVLHVH","婚":"LVHSVHLVZHH","混":"DDDVZHHHVSL","最":"VZHHHVHHDZD","彩":"SDDSHVSDSSS","祭":"SZDDZDHHVSD","菜":"HVVSDDSHVSD","崎":"VLVHVDHVZHV","惨":"SDVLDHSDSSS","赦":"HVHVVVDSHVL","斜":"SDHHVSDDDHV","蛇":"VZHVDDVVZSL","寂":"VVZVHHVSDZD","授":"HVDSDDSDZZD","宿":"DVZSVHSVZHH","淑":"DDDHVHVSDHL","庶":"VHVHVVHSDDD","商":"DHDSVZSDVZH","唱":"VZHVZHHVZHH","章":"VHDSHVZHHHV","常":"VDSSZVZHVZV","情":"SDVHVHHVZHH","深":"DDDVZVLHVSD","推":"HVDSVSHVHHH","崇":"VLVVVZHHVSD","据":"HVDZHVHVVZH","雀":"VSDSVSHVHHH","清":"DDDHVHHVZHH","惜":"SDVHVVHVZHH","接":"HVDVHDSHLVH","雪":"HVZVDDDDZHH","旋":"VHZVSHZVHVD","船":"SVZDVDSDVZH","措":"HVDHVVHVZHH","粗":"DSHVSDVZHHH","曹":"HVZVVHHVZHH","族":"VHZVSDSHHVD","袋":"SVHDDVHSVSD","逮":"ZHHVDDSDDZD","第":"SHVSHVZHVVS","脱":"VZHHDSVZHVL","探":"HVDVZVLHVSD","淡":"DDDVDVLVDVL","断":"DSHVSDLSVHV","窒":"VVZVLHLDHVH","著":"HVVHVHSVZHH","眺":"VZHHHVDDLSD","停":"SVVHVZHVZHV","笛":"SHVSHVVZVHH","添":"DDDSHVDVSDD","都":"HVHSVZHHZV","悼":"SDVVHVZHHHV","盗":"DDSZVDVZVVH","陶":"ZDVSZSHHVLV","堂":"VDSSZVZHHVH","得":"SSVVZHHHHVD","豚":"VZHHHSDSSSD","猫":"SVSHVVVZVHH","粘":"DSHVSDVHVZH","婆":"DDDVZVZDLVH","排":"HVDVHHHVHHH","培":"HVDVHDSHVZH","陪":"ZDVVHDSHVZH","舶":"SVZDVDSVZHH","票":"HVZVLHHHVSD","描":"HVDHVVVZVHH","符":"SHVSHVSVHVD","部":"VHDSHVZHZDV","副":"HVZHVZVHHVV","偏":"SVHZHVVZHVV","崩":"VLVVZHHVZHH","萌":"HVVVZHHVZHH","望":"VHLVZHHHVHH","麻":"VHVHVSDHVSD","密":"VVZVSLVDVLV","猛":"SVDZVHVZVVH","野":"VZHHVHDZDZV","唯":"VZHSVSHVHHH","悠":"SVVSHSDSLDD","庸":"VHVZHHVZHHV","溶":"DDDVVZSDVZH","欲":"SDSDVZHSZVD","翌":"ZDDZDDVHDSH","理":"HHVDVZHHVHH","率":"VHLLDDDSDHV","略":"VZVHHSZDVZH","粒":"DSHVSDVHDSH","隆":"ZDVSZDSHVHH","陵":"ZDVHVHSLSZD","累":"VZVHHLLDVSD","葵":"HVVZDSDSHHVD","握":"HVDZHVHLDHVH","越":"HVHVHSDVHLSD","援":"HVDSDDSHHVZD","奥":"SVZDSHVSDHVD","温":"DDDVZHHVZVVH","嫁":"LVHVVZSDSSSD","街":"SSVHVHHVDHHV","割":"VVZHVHHVZHVV","寒":"VVZHVVHHSDDD","堪":"HVDHVVHHHSLL","敢":"ZHVVHHDSHVD","棺":"HVSDVVZVZHZH","款":"HVHHHVSDSZVD","喜":"HVHVZHDSHVZH","期":"HVVHHHSDVZHH","棋":"HVSDHVVHHHSD","欺":"HVVHHHSDSZVD","距":"VZHVHVDVHZHH","勤":"HVVVZHVHHDZV","琴":"HVHDHVHHSDHZ","筋":"SHVSHVVZHHZV","遇":"VZHHVZVDDDZD","隅":"ZDVVZHHVZHHD","敬":"HVVSHVZHSHVD","景":"VZHHVHVZHVSD","湖":"DDDHVVZHVZHH","雇":"HZHVSVVHVHHH","御":"SSVSHHVHVDZV","慌":"SDVHVVVHLVVL","港":"DDDHVVHSDZHL","硬":"HVVZHHVZHHVD","裁":"HVHVHSVSDLSD","策":"SHVSHVHVZVSD","散":"HVVHVZHHSHVD","紫":"VHVDSLLLDVSD","滋":"DDDDSHLLDLLD","湿":"DDDVZHHVVDSH","煮":"HVHSVZHHSDDD","就":"VHVZHVSDHVLD","集":"SVSHVHHHHVSD","循":"SSVSVHVVZHHH","暑":"VZHHHVHSVZHH","掌":"VDSVZVZHSHHV","晶":"VZHHVZHHVZHH","焦":"SVSHVHHHSDDD","硝":"HVVZHVDSVZHH","象":"SZVZVHSDSSSD","植":"HVSDHVVZHHHL","殖":"HVHDHVVZHHHL","森":"HVSDHVSDHVSD","遂":"DSHSDSSSDDZD","随":"ZDVSHVZHHDZD","晴":"VZHHHVHHVZHH","税":"SHVSDDSVZHVL","善":"DSHHHVDSHVZH","然":"SZDDHVDDSDDD","葬":"HVVHSZDSLHVV","装":"VDDHVHVHSVSD","属":"ZHVSVZHVZVDD","尊":"DSHVZVLHHHVD","堕":"ZDVVHVZHHHVH","惰":"SDVHVHVHVZHH","替":"HHVDHHVDVZHH","棚":"HVSDVZHHVZHH","短":"SHHVDHVZHDSH","智":"SHHVDVZHVZHH","着":"DSHVHHSVZHHH","朝":"HVVZHHHVVZHH","超":"HVHVHSDZSVZH","痛":"VHVDDZDVZHHV","堤":"HVDVZHHHVHVD","提":"HVDVZHHHVHVD","程":"SHVSDVZHHHVH","殿":"ZVHVVHSDVHZD","渡":"DDDVHVHVVHZD","登":"ZDSDSHVZHDSH","塔":"HVDHVVSDHVZH","搭":"HVDHVVSDHVZH","痘":"VHVDDHVZHDSH","等":"SHDSHDHVHHVD","答":"SHVSHVSDHVZH","筒":"SHVSHVVZHVZH","童":"VHDSHVZHHVHH","道":"DSHSVZHHHDZD","媒":"LVHHVVHHHVSD","博":"HVHVZHHVDHVD","番":"SDSHVSDVZVHH","蛮":"VHVVSDVZHVDD","悲":"VHHHVHHHSLDD","扉":"HZHVVHHDVHHH","富":"VVZHVZHVZVHH","普":"DSHVVDSHVZHH","幅":"VZVHVZHVZVHH","遍":"HZHVVZHVVDZD","募":"HVVVZHHHSDZV","傍":"SVVHDSVZVHZS","帽":"VZVVZHHVZHHH","棒":"HVSDHHHVDHHV","婿":"LVHZVHVDVZHH","愉":"SDVSDHVZHHVV","裕":"VZVSDSDSDVZH","雄":"HVLDSVSHVHHH","落":"HVVDDDSZDVZH","痢":"VHVDDSHVSDVV","硫":"HVVZHVHLDVVL","量":"VZHHHVZHHVHH","裂":"HSZDVVVHSVSD","廊":"VHVVZHHVDZDV","惑":"HVZHDLSDSLDD","湾":"DDDVHVVSDZHV","腕":"VZHHVVZVHDZL","暗":"VZHHVHDSHVZHH","意":"VHDSHVZHHSLDD","猿":"SVSHVHVZHSVSD","暇":"VZHHZHVHHZHZD","雅":"HVHVSSVSHVHHH","解":"SZVZVHHZSSHHV","慨":"SDVZHHVDHVHVL","隔":"ZDVHVZHVZSLHV","滑":"DDDVZVHVZVLHH","褐":"VZVSDVZHHSZSL","感":"VHHVZHLSDSLDD","禁":"HVSDHVSDHHVSD","愚":"VZHHVZVDDSLDD","虞":"VHVZHLVZHVHSD","靴":"HVVHVZHHVSVSL","群":"ZHHVVZHDSHHHV","携":"HVDSVVHVHHHSZ","嫌":"LVHDSHZHHVVSD","献":"HVVZDSHHVHVDD","遣":"VZHVHVZHZHDZD","源":"DDDHVVVZHHVSD","鼓":"HVHVZHDSDHVZD","腰":"VZHHHVZVVHLVH","催":"SVVLVSVVHVHHH","罪":"VZVVHVHHDVHHH","嗣":"VZHVZHVVZHVZH","慈":"DSHLLDLLDSLDD","辞":"SHVVZHVHDSHHV","愁":"SHVSDVSVDSLDD","酬":"HVZVLHHSVDVDV","署":"VZVVHHVHSVZHH","照":"VZHHZSVZHSDDD","蒸":"HVVZVZSHHSDDD","触":"SZVZVHHVZHVDD","寝":"VVZVDDZHHVZZD","慎":"SDVHVVZHHHHSD","新":"DHDSHHVSDSVHV","睡":"VZHHHSHHVVHVH","数":"DSHVSDLVHSHVL","腺":"VZHHSVZHHVZSD","践":"VZHVHVDHHHLSD","禅":"VZVDDDSVZHHHV","塑":"DSHLVVVZHHHVH","僧":"SVDSVZVHHVZHH","想":"HVSDVZHHHSDDD","滞":"DDDHVVVHVZVZV","暖":"VZHHSDDSHHVZD","痴":"VHVDDSHHVDVZH","稚":"SHVSDSVSHVHHH","置":"VZVVHHVVZHHHL","蓄":"HVVVHLLDVZVHH","跳":"VZHVHVDVDDLSD","艇":"SVZDVDSHVHZHD","督":"VHHVSDZDVZHHH","漠":"DDDHVVVZHHHVD","搬":"HVDSVZDVDSHZD","微":"SSVVLVHVVSHVL","福":"VZVDHVZHVZVHH","腹":"VZHHSHVZHHSZD","墓":"HVVVZHHHSDHVH","幕":"HVVVZHHHSDVZV","盟":"VZHHVZHHVZVVH","誉":"DDSHSDDHHHVZH","蓉":"HVVVVZSDSDVZH","裸":"VZVSDVZHHHVSD","雷":"HVZVDDDDVZVHH","酪":"HVZVLHHSZDVZH","零":"HVZVDDDDSDHZV","廉":"VHVDSHZHHVVSD","路":"VZHVHHVSZDVZH","楼":"HVSDDSHVSDLVH","演":"DDDVVZHVZVHHSD","寡":"VVZHVVZHHHSDZS","歌":"HVZHVHVZHVSZVD","概":"HVSDZHHVDHVHVL","管":"SHVSHVVVZVZHZH","旗":"VHZVSHHVVHHHSD","疑":"SLSHHVDZDZVHVD","境":"HVDVHDSHVZHHVL","酵":"HVZVLHHHVHSZVH","豪":"VHVZHVZHSDSSSD","酷":"HVZVLHHSHVHVZH","魂":"HHLDSVZVHHVLLD","察":"VVZSZDDZDHHVSD","算":"SHVSHVVZHHHHVV","酸":"HVZVLHHLDVLSZD","雌":"VHVDSLSVSHVHHH","磁":"HVVZHDSHLLDLLD","漆":"DDDHVSDSDVDSSD","遮":"VHVHVVHSDDDDZD","需":"HVZVDDDDHSVZVV","塾":"VHVZHZVDVHDHVH","熟":"VHVZHZVDVHSDDD","彰":"VHDSHVZHHHVSSS","障":"ZDVVHDSHVZHHHV","精":"DSHVSDHVHHVZHH","誓":"HVDSVHVDHHHVZH","静":"HVHHVZHHSZZHHV","遭":"HVZVVHHVZHHDZD","像":"SVSZVZVHSDSSSD","憎":"SDVDSVZVHHVZHH","端":"VHDSDVLVHSVZVV","嫡":"LVHVHDSVZHVVZH","摘":"HVDVHDSVZHVVZH","滴":"DDDVHDSVZHVVZH","碑":"HVVZHSVZVHHSHV","鼻":"SVZHHHVZVHHHVL","漂":"DDDHVZVVHHHVSD","腐":"VHVSVHVDVZSDSD","碧":"HVHDSVZHHHSVZH","慕":"HVVVZHHHVDVSDD","暮":"HVVVZHHHSDVZHH","墨":"VZHHVHHSDDDHVH","膜":"VZHHHVVVZHHHVD","慢":"SDVVZHHVZVVHZD","漫":"DDDVZHHVZVVHZD","模":"HVSDHVVVZHHHVD","踊":"VZHVHVDZDVZHHV","僚":"SVHVDDSVZHHVSD","漏":"DDDZHVHVZVDDDD","慰":"ZHVHHVSDHVDSLDD","影":"VZHHDHVZHVSDSSS","横":"HVSDHVVHVZVHHSD","稼":"SHVSDVVZHSDSSSD","器":"VZHVZHHVDVZHVZH","嬉":"LVHHVHVZHDSHVZH","稿":"SHVSDVHVZHVZVZH","撮":"HVDVZHHHVHHDVZD","趣":"HVHVHSDHVHHDVZD","遵":"DSHVZVLHHHVDDZD","嘱":"VZHZHVSVZHVZVHD","震":"HVZVDDDDHVHHVSD","澄":"DDDZDSDSHVZHDSH","潜":"DDDHHVDHHVDVZHH","槽":"HVSDHVVZVVHVZHH","潮":"DDDHVVZHHHVVZHH","撤":"HVDVHLDVZHHSHVL","糖":"DSHVSDVHVZHHVZH","踏":"VZHVHVDVZSDVZHH","箱":"SHVSHVHVSDVZHHH","敷":"HVZHHVDVHZVSHVL","舞":"SHHVVVVHSZDHVHV","弊":"VDSVZVSDSHSDHVV","褒":"VHSVVZHHVSDSVSD","暴":"VZHHHVVHSDVDDSD","摩":"VHVHVSDHVSDSHHV","魅":"SVZVHHVLLDHHVSD","履":"ZHVSSVSHVZHHSZD","寮":"VVZHVDDSVZHHVSD","憾":"SDVVHHVZHDSDSDDD","凝":"DDSLSHHVDZDZVHVL","激":"DDDSVZHHVHZVSHVL","衡":"SSVSZVZVHHHVDHHV","儒":"SVHSZVDDDDHSVZVV","薪":"HVVVHDSHHVSDSVHV","整":"HVZHVSDSHSDHVHVH","操":"HVDVZHVZHVZHHVSD","燃":"DSVDVHDDHVDDSDDD","薄":"HVVDDDHVZHHVDHVD","繁":"SHLZVHSHSDLLDVSD","避":"ZHVVZHVHDSHHVDZD","壁":"ZHVVZHVHDSHHVHVH","膨":"VZHHHVHVZHDSDSSS","磨":"VHVHVSDHVSDHSVZH","融":"HVZHVZVLHVVZHVDD","擦":"HVDVVZSZDDZDHHVSD","爵":"SDDSVZVVHZHHVDHVD","礁":"HVVZHSVSHVHHHSDDD","燥":"DSVDVZHVZHVZHHVSD","霜":"HVZVDDDDHVSDVZHHH","瞳":"VZHHHVHDSHVZHHVHH","翼":"ZDDZDDVZVHHHVVHSD","襟":"VZVSDHVSDHVSDHHVSD","瞬":"VZHHHSDDSVZVHDHVHV","戴":"HVHVZVHHHVHVHSDLSD","藩":"HVVDDDSDSHVSDVZVHH","覆":"HVZVVHSSVSHVZHHSZD","癖":"VHVDDZHVVZHVHDSHHV","簿":"SHVSHVDDDHVZHHVHVD","翻":"SDSHVSDVZVHHZDDZDD","曜":"VZHHZHHZHHSVSHVHHH","警":"HVVSZVZHSHSDDHHHVZH","藻":"HVVDDDVZHVZHVZHHVSD","爆":"DSVDVZHHHVVHSDVDDSD","魔":"VHVHVSDHVSDSVZVHHSL","籍":"SHVSHVHHHVSDHVVHVZHH","露":"HVZVDDDDVZHVHVDSZDVZH","儿":"VL","几":"VZ","么":"SLD","习":"ZDD","个":"SDV","书":"ZZVD","车":"HLVH","什":"SVHV","气":"SHHH","见":"VZSL","认":"DDSD","互":"HLZH","从":"SDSD","巴":"ZVHL","长":"SHVD","们":"SVDVZ","对":"ZDHVD","汉":"DHDZD","兰":"DSHHH","电":"VZHHL","卡":"VHHVD","东":"HLVSD","务":"SZDZS","吗":"VZHZLH","妈":"LSHZLH","她":"LSHZVL","纸":"LSDSHD","老":"HVHSSL","师":"VVHVZV","欢":"ZDSZSD","问":"DVZVZH","买":"ZDDHSD","杂":"SZHVSD","红":"LSDHVH","场":"HVDZSS","华":"SVSLHV","页":"HSVZVD","吃":"VZHSHZ","你":"SVSZVSD","这":"DHSDDZH","报":"HVHZVZD","时":"VZHHHVD","进":"HHSVDZH","坐":"SDSDHVH","层":"ZHSHHLD","还":"HSVDDZH","词":"DHZHVZH","识":"DVVZHSD","诉":"DZSVHVD","邮":"VZHVHZV","听":"VZHSVHV","两":"HVZSDSD","张":"ZHLSHVD","找":"HVDHLSD","员":"VZHVZVD","汶":"DDDDHSD","吧":"VZHZVHL","饭":"SZVSVZD","每":"SHLZHDD","呢":"VZHZHVSL","爸":"SDSDZVHL","朋":"VZHHVZHH","图":"VZSZDDDH","舍":"SDHHVVZH","现":"HHVHVZSL","绍":"LSDZSVZH","姐":"LSHVZHHH","厕":"HSVZSDVV","话":"DDSHVVZH","帕":"VZVSVZHH","卖":"HVZHHHSD","咖":"VZHZVVZH","衬":"DZVSDHVD","衫":"DZVSDSSS","经":"LSDZDHVH","实":"DSZDDHSD","侨":"SVSHSDVV","很":"SSVZHHVSD","哪":"VZHHHHVZV","语":"DVHVZHVZH","贵":"VZHVHVZSD","说":"DDDSVZHVL","孩":"ZVDDHLSSD","给":"LSDSDHVZH","览":"VVSHDVZSL","穿":"DSZSDHLVS","钟":"SHHHVVZHV","觉":"DDSSZVZSL","哥":"HVZHVHVZHV","笔":"SHDSHDSHHL","谁":"DVSVDHHHVH","请":"DVHHVHVHHH","烟":"DVSDVZHHSD","啊":"VZHZVHVZHV","爱":"SDDSSZHSZD","阅":"DVZDSVZHVL","剧":"ZHVHVVZHVV","课":"DDVZHHHVSD","验":"ZLHSDHDDSH","热":"HVDVZDSDDD","桔":"HVSDHVHVZH","您":"SVSZVSDSLDD","银":"SHHHVZHHVSD","馆":"SZVDSZVZHZH","啡":"VZHVHHHVHHH","啤":"VZHSVZHHVHV","晚":"VZHHSZVZHVL","绿":"LSDZHHVHDSD","职":"HVVHHDVZHSD","谢":"DVSVZHHHSHVS","喂":"VZHVZHVHHVSD","裙":"DZVSDZHHVVZH","裤":"DZVSDDHVHLVH","鲁":"ZSVZHVHHVZHH","黑":"VZDSHHVHSVDD","蓝":"HVVVVVHDVZVVH","跟":"VZHVHVHZHHVSD","颜":"DHDSVHSSSHSVZVD","懂":"SVDHVVSHVZHHHVH","题":"VZHHHVHSDHSVZVD"};

  /** 手写超高频优先字表（首帧秒建） */
  var PRIORITY_CHARS =
    '一二三四五六七八九十百千万亿零两' +
    '人口手大小上下左右中日月水火山石田土工王木本末未正干于士才寸' +
    '天地风雨云雪雷电儿几了子女子好门问心必毛牛羊马鸟鱼虫目耳牙自白舌竹米言衣走足车金长雨青非面音页飞食首香高' +
    '的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经' +
    '之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器压志世金增争济阶油思术极交受联什认六共权收证改清己美再采转更单风切打白教速花带安场身车例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集温传土许步群广石记需段研界拉林律叫且究观越织装影算低持音众书布复容儿须际商非验连断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历市克何除消构府称太准精值号率族维划选标写存候毛亲快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属圆包火住调满县局照参红细引听该铁价严' +
    '爸妈哥姐弟妹爷奶叔姨猫狗兔虎龙蛇鸡鸭鹅猪花草树林森走跑跳坐立站吃喝说看听写读想玩睡东西南北前后里外条只个本张块杯件双多少长短高低新旧好坏对错开关找买送拿放爱恨笑哭喜怒吗呢吧啊呀哦哈嘿';

  /** 模板字体：楷体最接近手写，黑体提供结构骨架；第三款仅在常用字上使用 */
  var TEMPLATE_FONTS = [
    '"KaiTi","STKaiti","Kaiti SC","楷体","Noto Serif CJK SC","SimSun","Songti SC",serif',
    '"PingFang SC","Microsoft YaHei","Heiti SC","Noto Sans CJK SC","黑体",sans-serif',
    '"FangSong","STFangsong","FangSong_GB2312","仿宋",serif',
  ];

  var strokeMapCache = null;
  var strokeBuckets = null;
  var charRankMap = null;
  var templateByChar = new Map();
  var allTemplates = [];
  var allCharList = [];
  var buildState = null;
  var learnMap = null;
  var charIndexMap = null;

  /* ---------------- 基础工具 ---------------- */

  function initBuiltinTables() {
    if (strokeBuckets) return;
    strokeMapCache = Object.create(null);
    strokeBuckets = Object.create(null);
    Object.keys(BUILTIN_STROKES).forEach(function (k) {
      var cnt = Number(k) || 0;
      var chars = BUILTIN_STROKES[k] || '';
      strokeBuckets[cnt] = chars.split('');
      for (var i = 0; i < chars.length; i++) strokeMapCache[chars.charAt(i)] = cnt;
    });
  }

  function getCharStrokeCount(ch) {
    initBuiltinTables();
    var own = strokeMapCache[ch];
    if (own) return own;
    var ds = global.SK && global.SK.DictStore;
    if (ds && ds.getStrokeCount) {
      var c = ds.getStrokeCount(ch);
      if (c) { strokeMapCache[ch] = c; return c; }
    }
    return 0;
  }

  function getCharRank(ch, fallbackRank) {
    if (!charRankMap) {
      charRankMap = Object.create(null);
      for (var i = 0; i < BUILTIN_RANKED_CHARS.length; i++) {
        charRankMap[BUILTIN_RANKED_CHARS.charAt(i)] = i;
      }
    }
    var r = charRankMap[ch];
    return r === undefined ? (fallbackRank || 3000) : r;
  }

  var probeCanvas = null;
  function getProbeCanvas() {
    if (!probeCanvas) {
      probeCanvas = document.createElement('canvas');
      probeCanvas.width = probeCanvas.height = PROBE;
    }
    return probeCanvas;
  }

  var gridCanvas = null;
  function getGridCanvas() {
    if (!gridCanvas) {
      gridCanvas = document.createElement('canvas');
      gridCanvas.width = gridCanvas.height = GRID;
    }
    return gridCanvas;
  }

  var activeFonts = null;
  /** 用渲染指纹判断字体是否真的生效（中文字宽都一样，不能靠宽度判断） */
  function fontSignature(ctx, family) {
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#000';
    ctx.font = '32px ' + family;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('国永', 2, 44);
    var d = ctx.getImageData(0, 0, 64, 64).data;
    var h = 0;
    var ink = 0;
    for (var i = 3; i < d.length; i += 4) {
      var bit = d[i] > 96 ? 1 : 0;
      ink += bit;
      h = (h * 31 + bit) | 0;
    }
    return ink < 20 ? null : h;
  }

  function getActiveFonts() {
    if (activeFonts) return activeFonts;
    var canvas = getProbeCanvas();
    var ctx = canvas.getContext('2d');
    var seen = Object.create(null);
    var usable = [];
    TEMPLATE_FONTS.forEach(function (family) {
      var sig = fontSignature(ctx, family);
      if (sig == null || seen[sig]) return;
      seen[sig] = 1;
      usable.push(family);
    });
    activeFonts = usable.length ? usable : [TEMPLATE_FONTS[0]];
    return activeFonts;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  var bindPress = (global.SK && global.SK.KeyboardRender && global.SK.KeyboardRender.bindPress) ||
    function (node, handler) {
      node.addEventListener('click', function (ev) { handler(ev); });
    };

  function loadLearn() {
    if (learnMap) return learnMap;
    learnMap = Object.create(null);
    try {
      var raw = global.localStorage.getItem(LEARN_KEY);
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') learnMap = obj;
      }
    } catch (e) { /* 忽略 */ }
    return learnMap;
  }

  var learnSaveTimer = null;
  function saveLearn() {
    if (learnSaveTimer) return;
    learnSaveTimer = setTimeout(function () {
      learnSaveTimer = null;
      try {
        global.localStorage.setItem(LEARN_KEY, JSON.stringify(learnMap));
      } catch (e) { /* 忽略 */ }
    }, 600);
  }

  function learnChar(ch) {
    if (!ch) return;
    var map = loadLearn();
    map[ch] = Math.min(60, (Number(map[ch]) || 0) + 1);
    saveLearn();
  }

  function clearLearn() {
    learnMap = Object.create(null);
    try { global.localStorage.removeItem(LEARN_KEY); } catch (e) { /* 忽略 */ }
  }

  /* ---------------- 特征计算 ---------------- */

  /** 3-4 倒角距离变换，输出 Uint8（单位约等于像素） */
  function distanceTransform8(ink) {
    var w = GRID, h = GRID, n = w * h;
    var INF = 60000;
    var d = new Uint16Array(n);
    var i;
    for (i = 0; i < n; i++) d[i] = ink[i] ? 0 : INF;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = y * w + x;
        var v = d[idx];
        if (v === 0) continue;
        if (x > 0 && d[idx - 1] + 3 < v) v = d[idx - 1] + 3;
        if (y > 0 && d[idx - w] + 3 < v) v = d[idx - w] + 3;
        if (x > 0 && y > 0 && d[idx - w - 1] + 4 < v) v = d[idx - w - 1] + 4;
        if (x < w - 1 && y > 0 && d[idx - w + 1] + 4 < v) v = d[idx - w + 1] + 4;
        d[idx] = v;
      }
    }
    for (var y2 = h - 1; y2 >= 0; y2--) {
      for (var x2 = w - 1; x2 >= 0; x2--) {
        var i2 = y2 * w + x2;
        var v2 = d[i2];
        if (v2 === 0) continue;
        if (x2 < w - 1 && d[i2 + 1] + 3 < v2) v2 = d[i2 + 1] + 3;
        if (y2 < h - 1 && d[i2 + w] + 3 < v2) v2 = d[i2 + w] + 3;
        if (x2 < w - 1 && y2 < h - 1 && d[i2 + w + 1] + 4 < v2) v2 = d[i2 + w + 1] + 4;
        if (x2 > 0 && y2 < h - 1 && d[i2 + w - 1] + 4 < v2) v2 = d[i2 + w - 1] + 4;
        d[i2] = v2;
      }
    }
    var out = new Uint8Array(n);
    for (i = 0; i < n; i++) {
      var val = (d[i] / 3) | 0;
      out[i] = val > 255 ? 255 : val;
    }
    return out;
  }

  function quantize(arr) {
    var max = 0;
    for (var i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
    var out = new Uint8Array(arr.length);
    if (max <= 0) return out;
    var k = 255 / max;
    for (var j = 0; j < arr.length; j++) out[j] = Math.round(arr[j] * k);
    return out;
  }

  /** 分布归一化：只比较「墨迹分布形状」，与笔画粗细/总墨量无关 */
  function l1norm(arr) {
    var sum = 0;
    for (var i = 0; i < arr.length; i++) sum += arr[i];
    if (sum <= 0) return arr;
    var k = 1 / sum;
    for (var j = 0; j < arr.length; j++) arr[j] *= k;
    return arr;
  }

  function norm2(arr) {
    var n = 0;
    for (var i = 0; i < arr.length; i++) n += arr[i] * arr[i];
    return Math.sqrt(n);
  }

  /** 预计算模长后的余弦相似度 */
  function cosNorm(a, b, na, nb) {
    if (!na || !nb) return 0;
    var dot = 0;
    for (var i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot / (na * nb);
  }

  function cosSim(a, b) {
    return cosNorm(a, b, norm2(a), norm2(b));
  }

  function oriBin(dx, dy) {
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax >= ay * 1.6) return 0;   // 横
    if (ay >= ax * 1.6) return 1;   // 竖
    return (dx * dy >= 0) ? 2 : 3;  // 撇/捺
  }

  /** 从 48×48 灰度画布像素中提取全部特征 */
  function featuresFromAlpha(alpha) {
    var n = GRID * GRID;
    // 二值墨迹用位图存储（2304 bit = 288 字节），比 Uint8 省 2KB/模板
    var inkBits = new Uint8Array((n + 7) >> 3);
    var ink8 = new Uint8Array(n);
    var cnt = 0;
    var i;
    for (i = 0; i < n; i++) {
      if (alpha[i] > INK_ALPHA_THRESHOLD) {
        ink8[i] = 1;
        inkBits[i >> 3] |= 1 << (i & 7);
        cnt++;
      }
    }
    if (cnt < 4) return null;

    var dt = distanceTransform8(ink8);

    // 12×12 密度（带 3×3 平滑，抗位置抖动）
    var cell = GRID / DENS;
    var raw = new Float32Array(DENS * DENS);
    for (var gy = 0; gy < DENS; gy++) {
      for (var gx = 0; gx < DENS; gx++) {
        var s = 0;
        for (var yy = 0; yy < cell; yy++) {
          var row = (gy * cell + yy) * GRID + gx * cell;
          for (var xx = 0; xx < cell; xx++) s += alpha[row + xx];
        }
        raw[gy * DENS + gx] = s / (cell * cell * 255);
      }
    }
    var densF = new Float32Array(DENS * DENS);
    for (var y3 = 0; y3 < DENS; y3++) {
      for (var x3 = 0; x3 < DENS; x3++) {
        var acc = 0, wsum = 0;
        for (var ky = -1; ky <= 1; ky++) {
          var ny = y3 + ky;
          if (ny < 0 || ny >= DENS) continue;
          for (var kx = -1; kx <= 1; kx++) {
            var nx = x3 + kx;
            if (nx < 0 || nx >= DENS) continue;
            var weight = (kx === 0 && ky === 0) ? 4 : (kx === 0 || ky === 0 ? 2 : 1);
            acc += raw[ny * DENS + nx] * weight;
            wsum += weight;
          }
        }
        densF[y3 * DENS + x3] = acc / wsum;
      }
    }

    // 8+8 投影
    var projF = new Float32Array(16);
    var bandH = GRID / 8, bandW = GRID / 8;
    for (var by = 0; by < 8; by++) {
      var hSum = 0;
      for (var y4 = (by * bandH) | 0; y4 < ((by + 1) * bandH) | 0; y4++) {
        for (var x4 = 0; x4 < GRID; x4++) hSum += alpha[y4 * GRID + x4];
      }
      projF[by] = hSum;
    }
    for (var bx = 0; bx < 8; bx++) {
      var vSum = 0;
      for (var x5 = (bx * bandW) | 0; x5 < ((bx + 1) * bandW) | 0; x5++) {
        for (var y5 = 0; y5 < GRID; y5++) vSum += alpha[y5 * GRID + x5];
      }
      projF[8 + bx] = vSum;
    }

    // 8×8 × 4 方向图（按墨迹像素的位置 + 局部走向统计）
    var dirF = new Float32Array(DIR_DIM);
    var gdir = new Float32Array(4);
    for (var y6 = 1; y6 < GRID - 1; y6++) {
      for (var x6 = 1; x6 < GRID - 1; x6++) {
        var idx = y6 * GRID + x6;
        if (!ink8[idx]) continue;
        var dx = alpha[idx + 1] - alpha[idx - 1];
        var dy = alpha[idx + GRID] - alpha[idx - GRID];
        var mag = Math.abs(dx) + Math.abs(dy);
        if (mag < 6) mag = 6;
        var b = oriBin(dx, dy);
        var gxi = (x6 * DIRG / GRID) | 0;
        var gyi = (y6 * DIRG / GRID) | 0;
        if (gxi > DIRG - 1) gxi = DIRG - 1;
        if (gyi > DIRG - 1) gyi = DIRG - 1;
        dirF[(gyi * DIRG + gxi) * 4 + b] += mag;
        gdir[b] += mag;
      }
    }

    var dens8 = quantize(l1norm(densF));
    var proj8 = quantize(l1norm(projF));
    var dir8 = quantize(l1norm(dirF));
    var gdir8 = quantize(l1norm(gdir));

    return {
      ink: inkBits,
      inkCount: cnt,
      dt: dt,
      dens: dens8,
      proj: proj8,
      dir: dir8,
      gdir: gdir8,
      norms: [norm2(dens8), norm2(proj8), norm2(gdir8), norm2(dir8)],
    };
  }

  function computeTransform(bw, bh) {
    var avail = GRID - GRID_PAD * 2;
    var safeW = Math.max(1, bw);
    var safeH = Math.max(1, bh);
    var isoScale = Math.min(avail / safeW, avail / safeH);
    var ratio = Math.min(safeW, safeH) / Math.max(safeW, safeH);

    var scaleX, scaleY;
    if (ratio < 0.22) {
      scaleX = isoScale;
      scaleY = isoScale;
    } else {
      var blend = 0.55 * Math.min(1, (ratio - 0.22) / 0.28);
      scaleX = (1 - blend) * isoScale + blend * (avail / safeW);
      scaleY = (1 - blend) * isoScale + blend * (avail / safeH);
    }
    return {
      scaleX: scaleX,
      scaleY: scaleY,
      dstW: Math.max(1, Math.round(safeW * scaleX)),
      dstH: Math.max(1, Math.round(safeH * scaleY)),
      dx: (GRID - safeW * scaleX) / 2,
      dy: (GRID - safeH * scaleY) / 2,
      aspect: safeW / (safeW + safeH),
    };
  }

  /** 渲染一个字的字体模板并提取特征 */
  function renderCharTemplate(ch, fontFamily, strokes, rank) {
    var probe = getProbeCanvas();
    var pctx = probe.getContext('2d');
    pctx.clearRect(0, 0, PROBE, PROBE);
    pctx.fillStyle = '#000';
    pctx.textAlign = 'center';
    pctx.textBaseline = 'middle';
    pctx.font = Math.floor(PROBE * 0.84) + 'px ' + fontFamily;
    pctx.fillText(ch, PROBE / 2, PROBE / 2 + PROBE * 0.02);

    var src = pctx.getImageData(0, 0, PROBE, PROBE).data;
    var minX = PROBE, minY = PROBE, maxX = -1, maxY = -1;
    for (var y = 0; y < PROBE; y++) {
      for (var x = 0; x < PROBE; x++) {
        if (src[(y * PROBE + x) * 4 + 3] > INK_ALPHA_THRESHOLD) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;

    var bw = maxX - minX + 1;
    var bh = maxY - minY + 1;
    var tf = computeTransform(bw, bh);

    var canvas = getGridCanvas();
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, GRID, GRID);
    ctx.drawImage(probe, minX, minY, bw, bh, tf.dx, tf.dy, tf.dstW, tf.dstH);

    var data = ctx.getImageData(0, 0, GRID, GRID).data;
    var alpha = new Uint8Array(GRID * GRID);
    for (var i = 0, p = 3; i < alpha.length; i++, p += 4) alpha[i] = data[p];

    var f = featuresFromAlpha(alpha);
    if (!f) return null;

    return {
      char: ch,
      font: fontFamily,
      strokes: strokes,
      rank: rank,
      seq: BUILTIN_STROKE_SEQ[ch] || '',
      ink: f.ink,
      inkCount: f.inkCount,
      dt: f.dt,
      dens: f.dens,
      proj: f.proj,
      dir: f.dir,
      gdir: f.gdir,
      norms: f.norms,
      aspect: tf.aspect,
    };
  }

  /* ---------------- 模板按需构建 + 后台分批预热 ---------------- */

  function buildSingleCharTemplates(ch) {
    if (templateByChar.has(ch)) return templateByChar.get(ch);
    var fonts = getActiveFonts();
    var strokeCnt = getCharStrokeCount(ch);
    var cIdx = charIndexMap ? charIndexMap[ch] : undefined;
    var rank = getCharRank(ch, cIdx !== undefined ? 4520 + cIdx : 9999);
    var list = [];
    var fontCount = rank <= THIRD_FONT_MAX_RANK ? 3 : (rank <= SECOND_FONT_MAX_RANK ? 2 : 1);
    var limit = Math.min(fonts.length, fontCount);
    for (var f = 0; f < limit; f++) {
      var tpl = renderCharTemplate(ch, fonts[f], strokeCnt, rank);
      if (tpl) {
        list.push(tpl);
        allTemplates.push(tpl);
      }
    }
    templateByChar.set(ch, list);
    return list;
  }

  /** 确保与当前用户书写笔画数区间相关的所有汉字模板已构建（同步耗时仅几毫秒） */
  function ensureStrokeWindowBuilt(userStrokes, corners) {
    initBuiltinTables();
    var topLimit = Math.min(450, allCharList.length);
    for (var i = 0; i < topLimit; i++) {
      if (!templateByChar.has(allCharList[i])) buildSingleCharTemplates(allCharList[i]);
    }

    var minS = Math.max(1, userStrokes - 2);
    var maxS = Math.min(28, userStrokes + Math.min(7, Math.ceil(corners * 0.9) + 2));
    var builtNow = 0;
    var hasRemaining = false;
    for (var s = minS; s <= maxS; s++) {
      var bucket = strokeBuckets[s] || [];
      for (var b = 0; b < bucket.length; b++) {
        var ch = bucket[b];
        if (!templateByChar.has(ch)) {
          buildSingleCharTemplates(ch);
          builtNow++;
          if (builtNow >= 420) {
            hasRemaining = true;
            break;
          }
        }
      }
      if (hasRemaining) break;
    }
    return !hasRemaining;
  }

  function ensureBackgroundBuild(charList, onReady, onProgress) {
    initBuiltinTables();
    allCharList = charList;
    if (!charIndexMap) {
      charIndexMap = Object.create(null);
      for (var ci = 0; ci < charList.length; ci++) charIndexMap[charList[ci]] = ci;
    }
    if (templateByChar.size >= charList.length) {
      if (onReady) onReady();
      return true;
    }
    if (buildState) {
      if (onReady) buildState.callbacks.push(onReady);
      if (onProgress) buildState.progress = onProgress;
      return false;
    }
    buildState = {
      charList: charList,
      i: 0,
      callbacks: onReady ? [onReady] : [],
      progress: onProgress,
      timer: null,
    };
    stepBackgroundBuild();
    return false;
  }

  function stepBackgroundBuild() {
    if (!buildState) return;
    var charList = buildState.charList;
    var count = 0;
    while (buildState.i < charList.length && count < BUILD_BATCH) {
      var ch = charList[buildState.i++];
      if (!templateByChar.has(ch)) {
        buildSingleCharTemplates(ch);
        count++;
      }
    }
    if (buildState.progress) buildState.progress(templateByChar.size, charList.length);
    if (buildState.i < charList.length) {
      buildState.timer = setTimeout(stepBackgroundBuild, 8);
      return;
    }
    var cbs = buildState.callbacks;
    buildState = null;
    cbs.forEach(function (fn) {
      try { fn(); } catch (e) { console.error('[Handwriting] 回调异常', e); }
    });
  }

  /* ---------------- 用户笔迹几何分析 ---------------- */

  function classifySegmentCode(dx, dy) {
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax >= ay * 1.45) return 'H';
    if (ay >= ax * 1.45) return 'V';
    if (dx < 0 && dy >= 0) return 'S';
    if (dx >= 0 && dy >= 0) return 'D';
    if (dx < 0 && dy < 0) return 'S';
    return 'H';
  }

  function analyzeStrokeGeometry(strokes, minX, minY, bw, bh) {
    var safeW = Math.max(1, bw);
    var safeH = Math.max(1, bh);
    var normStrokes = [];
    var totalCorners = 0;
    var rawCodes = [];
    var elemCodes = [];

    for (var s = 0; s < strokes.length; s++) {
      var pts = strokes[s];
      if (!pts || !pts.length) continue;
      var first = pts[0];
      var last = pts[pts.length - 1];
      var sx = (first.x - minX) / safeW;
      var sy = (first.y - minY) / safeH;
      var ex = (last.x - minX) / safeW;
      var ey = (last.y - minY) / safeH;

      var sMinX = 1, sMaxX = 0, sMinY = 1, sMaxY = 0;
      var lenH = 0, lenV = 0, lenD1 = 0, lenD2 = 0, totalLen = 0;
      var corners = 0;
      var prevDx = 0, prevDy = 0, hasPrevDir = false;
      var cornerPts = [first];

      for (var i = 0; i < pts.length; i++) {
        var nx = (pts[i].x - minX) / safeW;
        var ny = (pts[i].y - minY) / safeH;
        if (nx < sMinX) sMinX = nx;
        if (nx > sMaxX) sMaxX = nx;
        if (ny < sMinY) sMinY = ny;
        if (ny > sMaxY) sMaxY = ny;

        if (i > 0) {
          var dx = pts[i].x - pts[i - 1].x;
          var dy = pts[i].y - pts[i - 1].y;
          var segLen = Math.hypot(dx, dy);
          if (segLen > 1.5) {
            totalLen += segLen;
            var ux = dx / segLen;
            var uy = dy / segLen;
            lenH += ux * ux * segLen;
            lenV += uy * uy * segLen;
            lenD1 += 0.5 * (ux + uy) * (ux + uy) * segLen;
            lenD2 += 0.5 * (ux - uy) * (ux - uy) * segLen;

            if (hasPrevDir && segLen > 3.5) {
              var dot = ux * prevDx + uy * prevDy;
              if (dot < 0.42) {
                corners++;
                cornerPts.push(pts[i]);
                prevDx = ux;
                prevDy = uy;
              }
            } else if (segLen > 3.5) {
              prevDx = ux;
              prevDy = uy;
              hasPrevDir = true;
            }
          }
        }
      }
      cornerPts.push(last);

      totalCorners += corners;
      var netDx = ex - sx;
      var netDy = ey - sy;
      var type = 'O';
      var seqCode = 'H';

      if (corners >= 1 && lenH > 0.22 * totalLen && lenV > 0.22 * totalLen) {
        var midPt = cornerPts[1] || pts[Math.min(2, pts.length - 1)];
        var firstIsH = Math.abs(midPt.x - first.x) >= Math.abs(midPt.y - first.y);
        type = firstIsH ? 'HV' : 'VH';
        seqCode = firstIsH ? 'Z' : 'L';
      } else if (lenH > lenV * 1.5 && lenH > lenD1 * 1.08 && lenH > lenD2 * 1.08) {
        type = 'H';
        seqCode = 'H';
      } else if (lenV > lenH * 1.5 && lenV > lenD1 * 1.08 && lenV > lenD2 * 1.08) {
        type = 'V';
        seqCode = 'V';
      } else if (netDx < -0.05 && netDy > 0.05) {
        type = 'S';
        seqCode = 'S';
      } else if (netDx > 0.03 && netDy > 0.03) {
        type = 'B';
        seqCode = 'D';
      } else if (Math.abs(netDx) >= Math.abs(netDy)) {
        type = 'H';
        seqCode = 'H';
      } else {
        type = 'V';
        seqCode = 'V';
      }

      rawCodes.push(seqCode);
      for (var cIdx = 0; cIdx < cornerPts.length - 1; cIdx++) {
        var pA = cornerPts[cIdx], pB = cornerPts[cIdx + 1];
        if (Math.hypot(pB.x - pA.x, pB.y - pA.y) > 4) {
          elemCodes.push(classifySegmentCode(pB.x - pA.x, pB.y - pA.y));
        }
      }

      normStrokes.push({
        type: type,
        seqCode: seqCode,
        sx: sx, sy: sy, ex: ex, ey: ey,
        cx: (sMinX + sMaxX) / 2,
        cy: (sMinY + sMaxY) / 2,
        w: sMaxX - sMinX,
        h: sMaxY - sMinY,
        corners: corners,
      });
    }

    return {
      strokeCount: normStrokes.length,
      corners: totalCorners,
      virtualStrokes: normStrokes.length + Math.round(totalCorners * 0.75),
      rawSeq: rawCodes.join(''),
      elemSeq: elemCodes.join(''),
      strokes: normStrokes,
    };
  }

  function computeSequenceSimilarity(uSeq, tSeq) {
    if (!uSeq || !tSeq) return 0;
    var m = uSeq.length, n = tSeq.length;
    if (!m || !n) return 0;
    var dp = new Uint8Array((m + 1) * (n + 1));
    var stride = n + 1;
    for (var i = 1; i <= m; i++) {
      var uc = uSeq.charCodeAt(i - 1);
      for (var j = 1; j <= n; j++) {
        var tc = tSeq.charCodeAt(j - 1);
        if (uc === tc) {
          dp[i * stride + j] = dp[(i - 1) * stride + (j - 1)] + 1;
        } else {
          var a = dp[(i - 1) * stride + j];
          var b = dp[i * stride + (j - 1)];
          dp[i * stride + j] = a > b ? a : b;
        }
      }
    }
    var lcs = dp[m * stride + n];
    var firstMatch = uSeq.charCodeAt(0) === tSeq.charCodeAt(0) ? 0.15 : 0;
    var lastMatch = uSeq.charCodeAt(m - 1) === tSeq.charCodeAt(n - 1) ? 0.12 : 0;
    return Math.min(1.0, (2 * lcs) / (m + n) + firstMatch + lastMatch);
  }

  /** 常见独体字结构加分（仅在特征吻合时给负值奖励，不对非标笔顺施加正惩罚） */
  function structuralBonus(ch, geo, aspect) {
    var n = geo.strokeCount;
    var st = geo.strokes;
    if (!n) return 0;

    if (n === 1) {
      if (ch === '一' && aspect > 0.72 && st[0].type === 'H') return -3.4;
      if ((ch === '乙' || ch === '了' || ch === '七' || ch === '九') && geo.corners >= 1) return -1.6;
      return 0;
    }

    if (n === 2) {
      var t0 = st[0].type, t1 = st[1].type;
      if (ch === '二' && t0 === 'H' && t1 === 'H') return -3.4;
      if (ch === '十' && ((t0 === 'H' && t1 === 'V') || (t0 === 'V' && t1 === 'H'))) return -3.4;
      if (ch === '人' && ((t0 === 'S' && t1 === 'B') || (t0 === 'B' && t1 === 'S'))) {
        var gapTop = Math.abs(st[1].sx - st[0].sx);
        return gapTop < 0.22 ? -3.0 : -1.2;
      }
      if (ch === '八' && ((t0 === 'S' && t1 === 'B') || (t0 === 'B' && t1 === 'S'))) {
        var sep = Math.abs(st[1].sx - st[0].sx);
        return sep >= 0.14 ? -3.0 : -1.2;
      }
      if (ch === '七' && (t0 === 'H' || t0 === 'S') && (t1 === 'VH' || t1 === 'V')) return -2.6;
      if (ch === '九' && (t0 === 'S' || t0 === 'V') && (t1 === 'HV' || geo.corners >= 1)) return -2.6;
      if (ch === '了' && (t0 === 'HV' || geo.corners >= 1) && (t1 === 'V' || t1 === 'VH')) return -2.5;
      if ((ch === '几' || ch === '儿') && (t0 === 'S' || t0 === 'V') && (t1 === 'HV' || t1 === 'VH')) return -2.2;
      if (ch === '丁' && t0 === 'H' && t1 === 'V' && st[0].cy < 0.38) return -2.5;
      if (ch === '卜' && t0 === 'V' && (t1 === 'B' || t1 === 'H')) return -2.5;
      if (ch === '厂' && t0 === 'H' && (t1 === 'S' || t1 === 'V')) return -2.5;
    }

    if (n === 3) {
      var s0 = st[0], s1 = st[1], s2 = st[2];
      var types = s0.type + ',' + s1.type + ',' + s2.type;
      if (ch === '三' && types === 'H,H,H') return -3.6;
      if (ch === '土' && (types === 'H,V,H' || types === 'H,H,V') && s2.cy > 0.62 && s2.w >= s0.w * 0.92) return -3.0;
      if (ch === '士' && types === 'H,V,H' && s2.cy > 0.62 && s0.w > s2.w * 1.05) return -2.8;
      if (ch === '工' && types === 'H,V,H' && s0.cy < 0.36 && s2.cy > 0.64) return -2.8;
      if (ch === '干' && types === 'H,H,V' && s2.ey > 0.72) return -2.8;
      if (ch === '千' && (s0.type === 'S' || s0.type === 'H') && s1.type === 'H' && s2.type === 'V') return -2.8;
      if (ch === '上' && (s0.type === 'V' || s1.type === 'V') && s2.type === 'H' && s2.cy > 0.62) return -3.0;
      if (ch === '下' && s0.type === 'H' && s0.cy < 0.36 && s1.type === 'V') return -3.0;
      if (ch === '大' && s0.type === 'H' && (s1.type === 'S' || s1.type === 'V') && (s2.type === 'B' || s2.type === 'H')) return -3.0;
      if (ch === '小' && s0.type === 'V' && (s1.type === 'S' || s1.type === 'V') && (s2.type === 'B' || s2.type === 'V')) return -3.0;
      if (ch === '口' && s0.type === 'V' && (s1.type === 'HV' || s1.corners >= 1) && s2.type === 'H') return -3.2;
      if (ch === '山' && s0.type === 'V' && (s1.type === 'VH' || s1.corners >= 1) && s2.type === 'V') return -3.0;
      if (ch === '川' && (s0.type === 'V' || s0.type === 'S') && s1.type === 'V' && s2.type === 'V') return -3.0;
      if (ch === '个' && s0.type === 'S' && s1.type === 'B' && s2.type === 'V') return -2.8;
      if (ch === '子' && (s0.type === 'HV' || s0.corners >= 1) && s2.type === 'H') return -2.6;
      if (ch === '女' && s0.corners >= 1 && (s1.type === 'S' || s1.type === 'V') && s2.type === 'H') return -2.6;
      if (ch === '门' && (s0.type === 'B' || s0.type === 'V') && s1.type === 'V' && (s2.type === 'HV' || s2.corners >= 1)) return -2.8;
    }

    if (n === 4) {
      var st0 = st[0], st1 = st[1], st2 = st[2], st3 = st[3];
      var t4 = st0.type + ',' + st1.type + ',' + st2.type + ',' + st3.type;
      if (ch === '王' && (t4 === 'H,H,V,H' || t4 === 'H,V,H,H')) return -3.2;
      if ((ch === '天' || ch === '夫') && st0.type === 'H' && st1.type === 'H' && st2.type === 'S' && st3.type === 'B') {
        if (ch === '天' && st2.sy >= st0.cy - 0.05) return -3.0;
        if (ch === '夫' && st2.sy < st0.cy - 0.05) return -3.0;
      }
      if (ch === '木' && st0.type === 'H' && st1.type === 'V' && st2.type === 'S' && st3.type === 'B') return -3.2;
      if (ch === '不' && st0.type === 'H' && st1.type === 'S' && st2.type === 'V' && st3.type === 'B') return -3.2;
      if (ch === '中' && st0.type === 'V' && (st1.type === 'HV' || st1.corners >= 1) && st2.type === 'H' && st3.type === 'V') return -3.4;
      if (ch === '日' && st0.type === 'V' && (st1.type === 'HV' || st1.corners >= 1) && st2.type === 'H' && st3.type === 'H') return -3.2;
      if (ch === '月' && (st0.type === 'S' || st0.type === 'V') && (st1.type === 'HV' || st1.corners >= 1) && st2.type === 'H' && st3.type === 'H') return -2.8;
      if (ch === '手' && (st0.type === 'S' || st0.type === 'H') && st1.type === 'H' && st2.type === 'H' && st3.type === 'V') return -3.0;
    }

    return 0;
  }

  /** 提取用户笔迹的归一化特征（与模板同构） */
  function extractUserFeatures(strokes) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var total = 0;
    for (var s = 0; s < strokes.length; s++) {
      var pts = strokes[s];
      total += pts.length;
      for (var p = 0; p < pts.length; p++) {
        var pt = pts[p];
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    }
    if (!total || minX === Infinity) return null;

    var bw = maxX - minX;
    var bh = maxY - minY;
    var tf = computeTransform(bw, bh);

    var canvas = getGridCanvas();
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, GRID, GRID);
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.lineWidth = INK_LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var offX = tf.dx - minX * tf.scaleX;
    var offY = tf.dy - minY * tf.scaleY;

    for (var s2 = 0; s2 < strokes.length; s2++) {
      var arr = strokes[s2];
      if (!arr.length) continue;
      if (arr.length === 1) {
        ctx.beginPath();
        ctx.arc(arr[0].x * tf.scaleX + offX, arr[0].y * tf.scaleY + offY, INK_LINE_WIDTH / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(arr[0].x * tf.scaleX + offX, arr[0].y * tf.scaleY + offY);
      for (var q = 1; q < arr.length; q++) {
        ctx.lineTo(arr[q].x * tf.scaleX + offX, arr[q].y * tf.scaleY + offY);
      }
      ctx.stroke();
    }

    var data = ctx.getImageData(0, 0, GRID, GRID).data;
    var alpha = new Uint8Array(GRID * GRID);
    for (var i = 0, pp = 3; i < alpha.length; i++, pp += 4) alpha[i] = data[pp];

    var f = featuresFromAlpha(alpha);
    if (!f) return null;

    var geo = analyzeStrokeGeometry(strokes, minX, minY, bw, bh);

    return {
      ink: f.ink,
      inkCount: f.inkCount,
      dt: f.dt,
      dens: f.dens,
      proj: f.proj,
      dir: f.dir,
      gdir: f.gdir,
      norms: f.norms,
      aspect: tf.aspect,
      geo: geo,
    };
  }

  /* ---------------- 两阶段打分 ---------------- */

  var W = {
    dens: 30,      // 12×12 密度余弦距离
    proj: 10,      // 投影余弦距离
    gdir: 6,       // 全局方向分布
    dir: 26,       // 8×8×4 方向图
    chamfer: 1.0,  // 倒角距离
    stroke: 1.0,   // 笔画数偏离
    aspect: 5.0,   // 宽高比
    balance: 1.0,  // 墨量比
    tolerance: 1.8,// 倒角容忍度（像素，抵消笔迹粗细差异）
  };

  /** 粗筛：分布类特征（与粗细无关）+ 笔画数硬约束 */
  function scoreCoarse(tpl, user) {
    var userStrokes = user.geo.strokeCount;
    if (tpl.strokes > 0 && userStrokes > 0) {
      if (tpl.strokes < userStrokes - 6) return null;
      if (tpl.strokes > userStrokes + Math.min(9, user.geo.corners + userStrokes + 3)) return null;
    }
    var un = user.norms;
    var tn = tpl.norms;
    var d = 0;
    d += (1 - cosNorm(user.dens, tpl.dens, un[0], tn[0])) * W.dens;
    d += (1 - cosNorm(user.dir, tpl.dir, un[3], tn[3])) * W.dir;
    d += (1 - cosNorm(user.proj, tpl.proj, un[1], tn[1])) * W.proj;
    d += (1 - cosNorm(user.gdir, tpl.gdir, un[2], tn[2])) * W.gdir;
    return d;
  }

  /** 细评：加入方向图与倒角距离、笔顺奖励、结构奖励 */
  function scoreFine(tpl, user) {
    var userStrokes = user.geo.strokeCount;
    var corners = user.geo.corners;
    var tplStrokes = tpl.strokes;
    var strokePenalty = 0;

    if (tplStrokes > 0 && userStrokes > 0) {
      var minExpected = Math.max(1, userStrokes - 2);
      var maxExpected = userStrokes + Math.min(8, Math.ceil(corners * 0.9) + (userStrokes >= 2 ? 2 : 1));
      if (userStrokes === 1 && corners <= 1 && tplStrokes > 6) return null;
      if (tplStrokes < userStrokes - 6 || tplStrokes > maxExpected + 7) return null;
      if (tplStrokes < minExpected) strokePenalty = (minExpected - tplStrokes) * 1.15;
      else if (tplStrokes > maxExpected) strokePenalty = (tplStrokes - maxExpected) * 1.05;
      else {
        var idealStrokes = userStrokes + Math.floor(corners * 0.45);
        strokePenalty = Math.abs(tplStrokes - idealStrokes) * 0.22;
      }
    }

    var ratio = user.inkCount / Math.max(1, tpl.inkCount);
    if (ratio < 0.08 || ratio > 7.5) return null;
    var aspectDiff = Math.abs(user.aspect - tpl.aspect);
    if (aspectDiff > 0.58) return null;

    var un = user.norms;
    var tn = tpl.norms;
    var densDist = (1 - cosNorm(user.dens, tpl.dens, un[0], tn[0])) * W.dens;
    var projDist = (1 - cosNorm(user.proj, tpl.proj, un[1], tn[1])) * W.proj;
    var gdirDist = (1 - cosNorm(user.gdir, tpl.gdir, un[2], tn[2])) * W.gdir;
    var dirDist = (1 - cosNorm(user.dir, tpl.dir, un[3], tn[3])) * W.dir;

    var sum1 = 0, sum2 = 0;
    var n = GRID * GRID;
    var uInk = user.ink, tInk = tpl.ink;
    var uDt = user.dt, tDt = tpl.dt;
    var tol = W.tolerance;
    for (var i = 0; i < n; i++) {
      var bit = 1 << (i & 7);
      var byte = i >> 3;
      if (uInk[byte] & bit) {
        var v1 = tDt[i] - tol;
        sum1 += v1 > 0 ? (v1 > MAX_DIST ? MAX_DIST : v1) : 0;
      }
      if (tInk[byte] & bit) {
        var v2 = uDt[i] - tol;
        sum2 += v2 > 0 ? (v2 > MAX_DIST ? MAX_DIST : v2) : 0;
      }
    }
    var d1 = sum1 / Math.max(1, user.inkCount);
    var d2 = sum2 / Math.max(1, tpl.inkCount);
    var chamfer = (0.62 * d1 + 0.38 * d2) * W.chamfer;

    var seqBonus = 0;
    if (tpl.seq && user.geo.rawSeq) {
      var simRaw = computeSequenceSimilarity(user.geo.rawSeq, tpl.seq);
      var simElem = user.geo.elemSeq ? computeSequenceSimilarity(user.geo.elemSeq, tpl.seq) : 0;
      var bestSim = Math.max(simRaw, simElem * 0.92);
      if (bestSim > 0.55) seqBonus = -(bestSim - 0.5) * 4.2;
    }

    var aspectPenalty = aspectDiff * W.aspect;
    var balance = W.balance * Math.abs(Math.log(Math.max(0.2, Math.min(4.0, ratio))));
    var freqPrior = Math.min(1.25, Math.log1p((tpl.rank || 0) * 0.04) * 0.24);
    var structAdj = structuralBonus(tpl.char, user.geo, user.aspect);

    var learnCount = loadLearn()[tpl.char] || 0;
    var learnBonus = learnCount ? -Math.min(6, Math.log1p(learnCount) * 2.6) : 0;

    return densDist + projDist + gdirDist + dirDist + chamfer + strokePenalty +
      aspectPenalty + balance + freqPrior + seqBonus + structAdj + learnBonus;
  }

  function matchTemplates(user) {
    var pool = allTemplates;
    if (!pool || !pool.length) return [];

    // ---- 阶段 1：粗筛 ----
    var coarse = [];
    for (var t = 0; t < pool.length; t++) {
      var sc = scoreCoarse(pool[t], user);
      if (sc == null) continue;
      coarse.push({ tpl: pool[t], c: sc });
    }
    if (!coarse.length) return [];
    coarse.sort(function (a, b) { return a.c - b.c; });
    var keep = Math.min(COARSE_KEEP, coarse.length);

    // ---- 阶段 2：细评（同字多字体取最优） ----
    var bestByChar = new Map();
    for (var k = 0; k < keep; k++) {
      var item = coarse[k];
      var fine = scoreFine(item.tpl, user);
      if (fine == null) continue;
      var prev = bestByChar.get(item.tpl.char);
      if (prev === undefined || fine < prev) bestByChar.set(item.tpl.char, fine);
    }

    var list = [];
    bestByChar.forEach(function (score, ch) { list.push({ char: ch, score: score }); });
    list.sort(function (a, b) { return a.score - b.score; });
    if (list.length < MAX_RESULT) {
      // 细评淘汰过多时，用粗筛 Top 补齐候选（保证翻页有内容）
      for (var q = 0; q < coarse.length && list.length < MAX_RESULT; q++) {
        if (!bestByChar.has(coarse[q].tpl.char)) {
          bestByChar.set(coarse[q].tpl.char, coarse[q].c * 1.2);
          list.push({ char: coarse[q].tpl.char, score: coarse[q].c * 1.2 });
        }
      }
    }
    return list.slice(0, MAX_RESULT);
  }

  /* ---------------- 面板 UI ---------------- */

  function mergeCharList(list, max) {
    initBuiltinTables();
    var seen = Object.create(null);
    var merged = [];
    function add(ch) {
      if (!ch || seen[ch]) return;
      seen[ch] = 1;
      merged.push(ch);
    }
    PRIORITY_CHARS.split('').forEach(add);
    (list || []).forEach(add);
    for (var i = 0; i < BUILTIN_RANKED_CHARS.length; i++) add(BUILTIN_RANKED_CHARS.charAt(i));
    var limit = Math.max(max || DEFAULT_MAX_CHARS, 4520);
    return merged.slice(0, limit);
  }

  function create(host, options) {
    var opts = options || {};
    var charList = mergeCharList(opts.charList, opts.maxChars || DEFAULT_MAX_CHARS);

    var wrap = el('div', 'sk-hand');

    var padBox = el('div', 'sk-hand-pad');
    var canvas = el('canvas', 'sk-hand-canvas');
    var placeholder = el('div', 'sk-hand-placeholder', '在此手写汉字（支持连笔 / 多页选字）');
    var status = el('div', 'sk-hand-status', '');
    padBox.appendChild(canvas);
    padBox.appendChild(placeholder);
    padBox.appendChild(status);

    var side = el('div', 'sk-hand-side');
    var tools = el('div', 'sk-hand-tools');
    var undoBtn = el('button', 'sk-hand-btn', '撤销');
    undoBtn.type = 'button';
    undoBtn.title = '撤销上一笔';
    var clearBtn = el('button', 'sk-hand-btn', '重写');
    clearBtn.type = 'button';
    clearBtn.title = '清空手写画布';
    var clearInputBtn = el('button', 'sk-hand-btn sk-hand-btn-danger', '清空输入');
    clearInputBtn.type = 'button';
    clearInputBtn.title = '一键清空输入框全部文字';
    var moreBtn = el('button', 'sk-hand-btn sk-hand-btn-primary', '更多 ▾');
    moreBtn.type = 'button';
    moreBtn.title = '展开大面板一页查看几十个候选字';
    tools.appendChild(undoBtn);
    tools.appendChild(clearBtn);
    tools.appendChild(clearInputBtn);
    tools.appendChild(moreBtn);

    var resultBox = el('div', 'sk-hand-result');

    var pager = el('div', 'sk-hand-pager');
    var prevPageBtn = el('button', 'sk-hand-page-btn', '‹ 上一页');
    prevPageBtn.type = 'button';
    var pageInfo = el('span', 'sk-hand-page-info', '6500 字库 · 停笔自动识别');
    var nextPageBtn = el('button', 'sk-hand-page-btn', '下一页 ›');
    nextPageBtn.type = 'button';
    pager.appendChild(prevPageBtn);
    pager.appendChild(pageInfo);
    pager.appendChild(nextPageBtn);

    side.appendChild(tools);
    side.appendChild(resultBox);
    side.appendChild(pager);

    wrap.appendChild(padBox);
    wrap.appendChild(side);
    host.appendChild(wrap);

    var ctx = canvas.getContext('2d');
    var strokes = [];
    var currentResults = [];
    var currentPage = 1;
    var drawing = false;
    var autoTimer = null;
    var dpr = 1;
    var pointerSeen = false;
    var lastCost = 0;

    function totalHandPages() {
      return Math.max(1, Math.ceil(currentResults.length / HAND_PAGE_SIZE));
    }

    function turnHandPage(delta) {
      var total = totalHandPages();
      var next = currentPage + delta;
      if (next < 1 || next > total) return;
      currentPage = next;
      renderResultPage();
    }

    function renderResultPage() {
      resultBox.textContent = '';
      var total = totalHandPages();
      if (currentPage > total) currentPage = total;

      if (!currentResults.length) {
        var emptyText = strokes.length
          ? '未识别出结果，请重写或调整笔画'
          : '手写识别候选区（写字后可翻页或点「更多 ▾」）';
        resultBox.appendChild(el('div', 'sk-hand-empty', emptyText));
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        moreBtn.disabled = true;
        pageInfo.textContent = '6500 字库 · 支持翻页与连笔';
        return;
      }

      var start = (currentPage - 1) * HAND_PAGE_SIZE;
      var pageSlice = currentResults.slice(start, start + HAND_PAGE_SIZE);

      pageSlice.forEach(function (item, idx) {
        var globalIdx = start + idx;
        var btn = el('button', 'sk-hand-cand' + (globalIdx === 0 ? ' is-first' : ''), item.char);
        btn.type = 'button';
        var py = (global.SK && global.SK.DictStore && global.SK.DictStore.getCharPinyin)
          ? global.SK.DictStore.getCharPinyin(item.char)
          : '';
        btn.title = (py ? item.char + ' (' + py + ') · ' : '') + '第 ' + (globalIdx + 1) + ' 候选';
        bindPress(btn, function () {
          learnChar(item.char);
          if (typeof opts.onSelect === 'function') opts.onSelect(item.char);
          clear();
        });
        resultBox.appendChild(btn);
      });

      prevPageBtn.disabled = currentPage <= 1;
      nextPageBtn.disabled = currentPage >= total;
      moreBtn.disabled = false;
      pageInfo.textContent = '第 ' + currentPage + '/' + total + ' 页（共 ' + currentResults.length +
        ' 字' + (lastCost ? ' · ' + lastCost + 'ms' : '') + '）';
    }

    var resizeRaf = 0;
    var lastW = 0;
    var lastH = 0;

    function resize() {
      if (resizeRaf) return;
      resizeRaf = (global.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); })(function () {
        resizeRaf = 0;
        var rect = padBox.getBoundingClientRect();
        var w = Math.max(120, Math.floor(rect.width));
        var h = Math.max(120, Math.floor(rect.height));
        // 尺寸没变就不动 canvas，避免 ResizeObserver 回调里反复触发回流
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        dpr = global.devicePixelRatio || 1;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        redraw();
      });
    }

    function drawGuideGrid(w, h) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 168, 196, 0.28)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
      ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(148, 168, 196, 0.16)';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(w, h);
      ctx.moveTo(w, 0); ctx.lineTo(0, h);
      ctx.stroke();
      ctx.restore();
    }

    function redraw() {
      var w = canvas.width / dpr;
      var h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawGuideGrid(w, h);
      ctx.strokeStyle = 'var(--sk-ink, #1f2937)';
      ctx.strokeStyle = '#1f2937';
      ctx.fillStyle = '#1f2937';
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      strokes.forEach(function (pts) {
        if (pts.length === 1) {
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, 2, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      });
    }

    function point(ev) {
      var rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    }

    function onDown(ev) {
      pointerSeen = true;
      ev.preventDefault();
      if (canvas.setPointerCapture && ev.pointerId != null) {
        try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
      }
      drawing = true;
      strokes.push([point(ev)]);
      placeholder.style.display = 'none';
      cancelAuto();
      redraw();
    }

    function onMove(ev) {
      if (!drawing) return;
      ev.preventDefault();
      var pts = strokes[strokes.length - 1];
      var pt = point(ev);
      var last = pts[pts.length - 1];
      if (last && Math.abs(last.x - pt.x) + Math.abs(last.y - pt.y) < 1.5) return;
      pts.push(pt);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }

    function onUp() {
      if (!drawing) return;
      drawing = false;
      scheduleAuto();
    }

    function cancelAuto() {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    }

    function scheduleAuto() {
      cancelAuto();
      if (!strokes.length) return;
      if (opts.autoRecognize === false) return;
      autoTimer = setTimeout(function () { recognize(); }, AUTO_RECOGNIZE_DELAY);
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onUp);
    canvas.addEventListener('mousedown', function (ev) { if (pointerSeen) return; onDown(ev); });
    canvas.addEventListener('mousemove', function (ev) { if (pointerSeen) return; onMove(ev); });
    canvas.addEventListener('mouseup', function (ev) { if (pointerSeen) return; onUp(ev); });

    function reportBuild(done, total) {
      if (done >= total) status.textContent = '';
      else status.textContent = '字库预热 ' + Math.min(99, Math.round((done / total) * 100)) + '%';
    }

    function recognize() {
      cancelAuto();
      if (!strokes.length) return [];
      var t0 = global.performance && global.performance.now ? global.performance.now() : Date.now();
      var user = extractUserFeatures(strokes);
      if (!user) return [];

      var windowComplete = ensureStrokeWindowBuilt(user.geo.strokeCount, user.geo.corners);
      ensureBackgroundBuild(charList, function () { status.textContent = ''; }, reportBuild);
      if (!windowComplete) {
        setTimeout(function () { if (strokes.length) recognize(); }, 18);
      }

      var result = [];
      try {
        result = matchTemplates(user);
      } catch (err) {
        console.error('[Handwriting] 识别失败', err);
      }
      var t1 = global.performance && global.performance.now ? global.performance.now() : Date.now();
      lastCost = Math.max(1, Math.round(t1 - t0));
      if (templateByChar.size >= charList.length) status.textContent = '';
      currentResults = result;
      currentPage = 1;
      renderResultPage();
      if (typeof opts.onRecognize === 'function') opts.onRecognize(result, lastCost);
      return result;
    }

    function undo() {
      cancelAuto();
      if (!strokes.length) return;
      strokes.pop();
      redraw();
      if (!strokes.length) {
        placeholder.style.display = '';
        currentResults = [];
        currentPage = 1;
        renderResultPage();
        if (typeof opts.onRecognize === 'function') opts.onRecognize([]);
      } else {
        recognize();
      }
    }

    function clear() {
      cancelAuto();
      strokes = [];
      currentResults = [];
      currentPage = 1;
      placeholder.style.display = '';
      if (!buildState) status.textContent = '';
      renderResultPage();
      redraw();
    }

    bindPress(undoBtn, function () { undo(); });
    bindPress(clearBtn, function () {
      clear();
      if (typeof opts.onRecognize === 'function') opts.onRecognize([]);
    });
    bindPress(clearInputBtn, function () {
      clear();
      if (typeof opts.onClearInput === 'function') opts.onClearInput();
    });
    bindPress(moreBtn, function () {
      if (typeof opts.onOpenMore === 'function') opts.onOpenMore();
    });
    bindPress(prevPageBtn, function () { turnHandPage(-1); });
    bindPress(nextPageBtn, function () { turnHandPage(1); });

    if (global.ResizeObserver) {
      var ro = new global.ResizeObserver(function () { resize(); });
      ro.observe(padBox);
    }
    global.addEventListener('resize', resize);
    renderResultPage();
    resize();

    setTimeout(function () {
      try { ensureBackgroundBuild(charList, function () { status.textContent = ''; }); } catch (e) { /* 忽略 */ }
    }, 60);

    return {
      el: wrap,
      clear: clear,
      undo: undo,
      recognize: recognize,
      turnPage: turnHandPage,
      charList: function () { return charList.slice(); },
      setAutoRecognize: function (on) { opts.autoRecognize = on !== false; },
      activate: function () {
        resize();
        setTimeout(function () {
          try {
            ensureBackgroundBuild(charList, function () { status.textContent = ''; }, reportBuild);
          } catch (err) { /* 忽略 */ }
        }, 0);
      },
      hasInk: function () { return strokes.length > 0; },
      lastCost: function () { return lastCost; },
      destroy: function () {
        cancelAuto();
        global.removeEventListener('resize', resize);
      },
    };
  }

  global.SK = global.SK || {};
  global.SK.Handwriting = {
    create: create,
    GRID: GRID,
    clearLearn: clearLearn,
    version: '3.0.0',
    /* ---- 自测钩子：用「墨迹像素矩阵」走完整识别链路，供准确率回归测试使用 ---- */
    _recognizeAlpha: function (alpha, extra) {
      var f = featuresFromAlpha(alpha);
      if (!f) return [];
      var info = extra || {};
      var geo = info.geo || {
        strokeCount: info.strokeCount || 0,
        corners: info.corners || 0,
        strokes: [],
        rawSeq: '',
        elemSeq: '',
      };
      return matchTemplates({
        ink: f.ink, inkCount: f.inkCount, dt: f.dt,
        dens: f.dens, proj: f.proj, dir: f.dir, gdir: f.gdir,
        norms: f.norms,
        aspect: info.aspect || 0.5,
        geo: geo,
      });
    },
    _buildTemplates: function (list) {
      allCharList = list || [];
      charIndexMap = charIndexMap || Object.create(null);
      for (var i = 0; i < allCharList.length; i++) {
        if (charIndexMap[allCharList[i]] === undefined) charIndexMap[allCharList[i]] = i;
      }
      allCharList.forEach(function (ch) {
        if (!templateByChar.has(ch)) buildSingleCharTemplates(ch);
      });
      return templateByChar.size;
    },
    _templateStats: function () {
      var bytes = 0;
      allTemplates.forEach(function (t) {
        bytes += t.ink.length + t.dt.length + t.dens.length + t.proj.length + t.dir.length + t.gdir.length;
      });
      return { chars: templateByChar.size, templates: allTemplates.length, featureBytes: bytes };
    },
    _weights: W,
    _setFontTiers: function (t3, t2) {
      if (typeof t3 === 'number') THIRD_FONT_MAX_RANK = t3;
      if (typeof t2 === 'number') SECOND_FONT_MAX_RANK = t2;
      return [THIRD_FONT_MAX_RANK, SECOND_FONT_MAX_RANK];
    },
    _setWeights: function (obj) {
      if (!obj) return W;
      Object.keys(obj).forEach(function (k) {
        if (typeof obj[k] === 'number') W[k] = obj[k];
      });
      return W;
    },
    _fonts: function () { return getActiveFonts(); },
  };
})(window);
