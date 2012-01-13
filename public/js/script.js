
$('.commands').on('click', 'a', function(e) {
	e.preventDefault();
	var command = $(this).attr('data-command');
	var param = $(this).attr('data-param');
	
	$.ajax({
		url: '/command/',
		data: { 'command' : command, 'param' : param },
		success: function(){
			$(this).addClass("done");
		}
	});
});


$('#frm-speak').on('submit', function(e) {
	e.preventDefault();
	var param = $('#txt-speak').val();
	
	$.ajax({
		url: '/command/',
		data: { 'command' : 'speak', 'param' : param },
		complete: function(){
			console.log('complete');
			$('#txt-speak').val('');
		}
	});
	
});